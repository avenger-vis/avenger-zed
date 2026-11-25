use std::collections::BTreeMap;

use zed::serde_json::{Value, json};
use zed::settings::LspSettings;
use zed::{
    DebugAdapterBinary, DebugConfig, DebugRequest, DebugScenario, DebugTaskDefinition,
    StartDebuggingRequestArguments, StartDebuggingRequestArgumentsRequest, TaskTemplate,
};
use zed_extension_api as zed;

/// The language servers of `extension.toml`: avenger's, `avenger lsp`, for Avenger SQL, Avenger
/// Quarto, and Quarto, and Quarto 2's, `q2 lsp`, for Avenger Quarto.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Server {
    Avenger,
    Quarto2,
}

impl Server {
    fn of(id: &zed::LanguageServerId) -> zed::Result<Self> {
        match id.as_ref() {
            "avenger-lsp" => Ok(Server::Avenger),
            "quarto2-lsp" => Ok(Server::Quarto2),
            _ => Err(format!("unsupported language server `{id}`")),
        }
    }

    /// The server's id, the key of its settings under `lsp`.
    fn id(self) -> &'static str {
        match self {
            Server::Avenger => "avenger-lsp",
            Server::Quarto2 => "quarto2-lsp",
        }
    }
}
/// The name of the debug adapter, `avenger dap`, and of the locator that turns the run arrows' task
/// into its scenarios.
const DEBUG_ADAPTER_NAME: &str = "avenger";
const DEBUG_LOCATOR_NAME: &str = "avenger";

struct AvengerExtension;

impl zed::Extension for AvengerExtension {
    fn new() -> Self {
        Self
    }

    fn language_server_command(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<zed::Command> {
        let server = Server::of(language_server_id)?;
        let settings = LspSettings::for_worktree(server.id(), worktree)?;
        let (path, arguments, env) = settings.binary.map_or_else(
            || (None, None, BTreeMap::new()),
            |binary| {
                (
                    binary.path,
                    binary.arguments,
                    binary.env.unwrap_or_default().into_iter().collect(),
                )
            },
        );
        let settings = LaunchSettings {
            path,
            arguments,
            env,
        };
        let launch = match server {
            Server::Avenger => resolve_launch(
                Process::LanguageServer,
                settings,
                launch_environment(worktree),
            )?,
            Server::Quarto2 => resolve_quarto2_launch(settings, quarto2_environment(worktree))?,
        };
        Ok(zed::Command {
            command: launch.command,
            args: launch.args,
            env: launch.env.into_iter().collect(),
        })
    }

    fn language_server_initialization_options(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        let server = Server::of(language_server_id)?;
        Ok(LspSettings::for_worktree(server.id(), worktree)?.initialization_options)
    }

    fn language_server_workspace_configuration(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        let server = Server::of(language_server_id)?;
        Ok(LspSettings::for_worktree(server.id(), worktree)?.settings)
    }

    /// `avenger dap`, found as the language server is, which runs in the worktree's root, since a
    /// target's path is relative to the project, and takes the configuration as its `launch`
    /// request's arguments.
    fn get_dap_binary(
        &mut self,
        adapter_name: String,
        config: DebugTaskDefinition,
        user_provided_debug_adapter_path: Option<String>,
        worktree: &zed::Worktree,
    ) -> zed::Result<DebugAdapterBinary> {
        validate_debug_adapter_name(&adapter_name)?;
        let launch = resolve_launch(
            Process::Debugger,
            LaunchSettings {
                path: user_provided_debug_adapter_path,
                ..LaunchSettings::default()
            },
            launch_environment(worktree),
        )?;
        Ok(DebugAdapterBinary {
            command: Some(launch.command),
            arguments: launch.args,
            envs: launch.env.into_iter().collect(),
            cwd: Some(worktree.root_path()),
            connection: None,
            request_args: StartDebuggingRequestArguments {
                configuration: config.config,
                request: StartDebuggingRequestArgumentsRequest::Launch,
            },
        })
    }

    /// Every session launches its target: the adapter has no attach.
    fn dap_request_kind(
        &mut self,
        adapter_name: String,
        config: Value,
    ) -> zed::Result<StartDebuggingRequestArgumentsRequest> {
        validate_debug_adapter_name(&adapter_name)?;
        match config.get("request").and_then(Value::as_str) {
            None | Some("launch") => Ok(StartDebuggingRequestArgumentsRequest::Launch),
            Some(request) => Err(format!(
                "the avenger debugger launches its target and takes no `{request}` request"
            )),
        }
    }

    /// The new session dialog's program is the target, a script or a Quarto document's cell, at
    /// the line of its first argument when that is a number.
    fn dap_config_to_scenario(&mut self, config: DebugConfig) -> zed::Result<DebugScenario> {
        validate_debug_adapter_name(&config.adapter)?;
        let DebugRequest::Launch(launch) = config.request else {
            return Err("the avenger debugger launches its target and has no attach".to_owned());
        };
        let target = match launch
            .args
            .first()
            .and_then(|line| line.trim().parse::<u32>().ok())
        {
            Some(line) if line > 0 => format!("{}:{line}", launch.program),
            _ => launch.program,
        };
        let mut scenario = json!({ "request": "launch", "target": target });
        if let Some(stop_on_entry) = config.stop_on_entry {
            scenario["stopOnEntry"] = stop_on_entry.into();
        }
        Ok(DebugScenario {
            label: config.label,
            adapter: DEBUG_ADAPTER_NAME.to_owned(),
            build: None,
            config: scenario.to_string(),
            tcp_connection: None,
        })
    }

    /// The run arrows' task, `avenger view TARGET`, debugs its target, the arrow's statement,
    /// without a build. Zed substitutes the task's variables, as `$ZED_FILE:$ZED_ROW`, in the
    /// scenario's configuration when the session starts.
    fn dap_locator_create_scenario(
        &mut self,
        locator_name: String,
        build_task: TaskTemplate,
        resolved_label: String,
        _debug_adapter_name: String,
    ) -> Option<DebugScenario> {
        if locator_name != DEBUG_LOCATOR_NAME {
            return None;
        }
        let target = view_target(&build_task.command, &build_task.args)?;
        Some(DebugScenario {
            label: resolved_label,
            adapter: DEBUG_ADAPTER_NAME.to_owned(),
            build: None,
            config: json!({ "request": "launch", "target": target }).to_string(),
            tcp_connection: None,
        })
    }

    /// Zed runs a locator only after a scenario's build, and this locator's scenarios have none.
    fn run_dap_locator(
        &mut self,
        _locator_name: String,
        _build_task: TaskTemplate,
    ) -> zed::Result<DebugRequest> {
        Err("the avenger locator's scenarios have no build, so no build runs".to_owned())
    }
}

zed::register_extension!(AvengerExtension);

fn validate_debug_adapter_name(name: &str) -> zed::Result<()> {
    if name == DEBUG_ADAPTER_NAME {
        Ok(())
    } else {
        Err(format!("unsupported debug adapter `{name}`"))
    }
}

/// The target of a task that runs `avenger view`: its first argument after `view` that isn't an
/// option. A task of another command, or of another `avenger` command, has none.
fn view_target<'a>(command: &str, args: &'a [String]) -> Option<&'a str> {
    let program = command.rsplit(['/', '\\']).next().unwrap_or(command);
    let program = program.strip_suffix(".exe").unwrap_or(program);
    let (subcommand, rest) = args.split_first()?;
    if program != "avenger" || subcommand != "view" {
        return None;
    }
    let mut rest = rest.iter();
    while let Some(arg) = rest.next() {
        if arg == "--color-scheme" {
            rest.next();
        } else if !arg.starts_with('-') {
            return Some(arg);
        }
    }
    None
}

/// The `avenger` process that the extension starts: the language server, `avenger lsp`, or the
/// debug adapter, `avenger dap`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Process {
    LanguageServer,
    Debugger,
}

impl Process {
    fn subcommand(self) -> &'static str {
        match self {
            Process::LanguageServer => "lsp",
            Process::Debugger => "dap",
        }
    }

    fn name(self) -> &'static str {
        match self {
            Process::LanguageServer => "language server",
            Process::Debugger => "debugger",
        }
    }

    /// The setting of Zed that names the binary.
    fn setting(self) -> &'static str {
        match self {
            Process::LanguageServer => "lsp.avenger-lsp.binary.path",
            Process::Debugger => "dap.avenger.binary",
        }
    }

    /// What starts the process again, once its binary is built.
    fn restart(self) -> &'static str {
        match self {
            Process::LanguageServer => "restart the language server",
            Process::Debugger => "start the debug session again",
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct LaunchSettings {
    path: Option<String>,
    arguments: Option<Vec<String>>,
    env: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct LaunchEnvironment {
    is_avenger_monorepo: bool,
    release_avenger: Option<String>,
    avenger: Option<String>,
    shell_env: BTreeMap<String, String>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
struct LaunchCommand {
    command: String,
    args: Vec<String>,
    env: BTreeMap<String, String>,
}

/// What the worktree tells of the `avenger` binaries: whether it is an avenger checkout, its
/// release binary, and the binary on the shell's `PATH`.
fn launch_environment(worktree: &zed::Worktree) -> LaunchEnvironment {
    let is_avenger_monorepo = worktree
        .read_text_file("Cargo.toml")
        .is_ok_and(|manifest| is_avenger_monorepo(&manifest));
    LaunchEnvironment {
        is_avenger_monorepo,
        release_avenger: is_avenger_monorepo
            .then(|| worktree.which("target/release/avenger"))
            .flatten(),
        avenger: worktree.which("avenger"),
        shell_env: worktree.shell_env().into_iter().collect(),
    }
}

/// The command of `process`, from the first of: the binary of the user's setting, an avenger
/// checkout's release binary, and `avenger` on the shell's `PATH`.
fn resolve_launch(
    process: Process,
    settings: LaunchSettings,
    environment: LaunchEnvironment,
) -> Result<LaunchCommand, String> {
    let explicit_path = settings.path.filter(|path| !path.trim().is_empty());
    let command = if let Some(path) = explicit_path {
        path
    } else if environment.is_avenger_monorepo {
        environment.release_avenger.ok_or_else(|| {
            format!(
                "Avenger release binary not found at `target/release/avenger`. Run \
                 `cargo build --release -p avenger-cli --bin avenger` from the Avenger \
                 repository, then {}.",
                process.restart()
            )
        })?
    } else if let Some(avenger) = environment.avenger {
        avenger
    } else {
        return Err(format!(
            "Avenger {} not found. Install `avenger` on PATH or configure `{}` in Zed \
             settings.",
            process.name(),
            process.setting()
        ));
    };

    let mut env = environment.shell_env;
    env.extend(settings.env);
    Ok(LaunchCommand {
        command,
        args: settings
            .arguments
            .unwrap_or_else(|| vec![process.subcommand().to_owned()]),
        env,
    })
}

/// What the worktree tells of Quarto 2's binaries on the shell's `PATH`: `quarto2`, which q2's
/// plans name as its command after its 0.x releases, and `q2`, its command until then.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
struct Quarto2Environment {
    quarto2: Option<String>,
    q2: Option<String>,
    shell_env: BTreeMap<String, String>,
}

fn quarto2_environment(worktree: &zed::Worktree) -> Quarto2Environment {
    Quarto2Environment {
        quarto2: worktree.which("quarto2"),
        q2: worktree.which("q2"),
        shell_env: worktree.shell_env().into_iter().collect(),
    }
}

/// The command of Quarto 2's language server, from the first of: the binary of the user's
/// setting, `quarto2` on the shell's `PATH`, and `q2` on it, with the arguments `lsp`.
fn resolve_quarto2_launch(
    settings: LaunchSettings,
    environment: Quarto2Environment,
) -> Result<LaunchCommand, String> {
    let explicit_path = settings.path.filter(|path| !path.trim().is_empty());
    let command = explicit_path
        .or(environment.quarto2)
        .or(environment.q2)
        .ok_or_else(|| {
            "Quarto 2's language server not found. Install q2 (`brew install \
             quarto-dev/tap/q2`) or configure `lsp.quarto2-lsp.binary.path` in Zed settings; \
             or turn it off with `\"languages\": { \"Avenger Quarto\": { \"language_servers\": \
             [\"!quarto2-lsp\", \"...\"] } }`."
                .to_owned()
        })?;
    let mut env = environment.shell_env;
    env.extend(settings.env);
    Ok(LaunchCommand {
        command,
        args: settings.arguments.unwrap_or_else(|| vec!["lsp".to_owned()]),
        env,
    })
}

fn is_avenger_monorepo(manifest: &str) -> bool {
    manifest.contains("avenger-cli") && manifest.contains("[workspace]")
}

#[cfg(test)]
mod tests {
    use zed::Extension as _;
    use zed::serde_json;

    use super::*;

    fn environment() -> LaunchEnvironment {
        LaunchEnvironment {
            is_avenger_monorepo: false,
            release_avenger: None,
            avenger: Some("/usr/local/bin/avenger".into()),
            shell_env: BTreeMap::from([
                ("PATH".into(), "/toolchain:/usr/local/bin".into()),
                ("RUST_LOG".into(), "info".into()),
            ]),
        }
    }

    #[test]
    fn explicit_binary_has_highest_precedence_and_merges_settings() {
        let mut detected = environment();
        detected.is_avenger_monorepo = true;
        let command = resolve_launch(
            Process::LanguageServer,
            LaunchSettings {
                path: Some("/custom/avenger".into()),
                arguments: Some(vec!["lsp".into(), "--future-option".into()]),
                env: BTreeMap::from([
                    ("RUST_LOG".into(), "debug".into()),
                    ("CUSTOM".into(), "1".into()),
                ]),
            },
            detected,
        )
        .unwrap();
        assert_eq!(command.command, "/custom/avenger");
        assert_eq!(command.args, ["lsp", "--future-option"]);
        assert_eq!(command.env["RUST_LOG"], "debug");
        assert_eq!(command.env["CUSTOM"], "1");
        assert!(command.env.contains_key("PATH"));
    }

    #[test]
    fn monorepo_uses_repository_release_binary() {
        let mut detected = environment();
        detected.is_avenger_monorepo = true;
        detected.release_avenger = Some("/workspace/target/release/avenger".into());
        let command =
            resolve_launch(Process::LanguageServer, LaunchSettings::default(), detected).unwrap();
        assert_eq!(command.command, "/workspace/target/release/avenger");
        assert_eq!(command.args, ["lsp"]);
    }

    #[test]
    fn monorepo_without_release_binary_returns_build_guidance() {
        let mut detected = environment();
        detected.is_avenger_monorepo = true;
        let error = resolve_launch(Process::LanguageServer, LaunchSettings::default(), detected)
            .unwrap_err();
        assert!(error.contains("target/release/avenger"));
        assert!(error.contains("cargo build --release -p avenger-cli --bin avenger"));
    }

    #[test]
    fn ordinary_project_uses_avenger_from_shell_path() {
        let command = resolve_launch(
            Process::LanguageServer,
            LaunchSettings::default(),
            environment(),
        )
        .unwrap();
        assert_eq!(command.command, "/usr/local/bin/avenger");
        assert_eq!(command.args, ["lsp"]);
    }

    fn quarto2_environment() -> Quarto2Environment {
        Quarto2Environment {
            quarto2: None,
            q2: Some("/opt/homebrew/bin/q2".into()),
            shell_env: BTreeMap::from([("PATH".into(), "/opt/homebrew/bin".into())]),
        }
    }

    #[test]
    fn servers_are_known_by_their_ids() {
        assert_eq!(Server::Avenger.id(), "avenger-lsp");
        assert_eq!(Server::Quarto2.id(), "quarto2-lsp");
    }

    #[test]
    fn quarto2_starts_q2_lsp_from_the_shell_path() {
        let command =
            resolve_quarto2_launch(LaunchSettings::default(), quarto2_environment()).unwrap();
        assert_eq!(command.command, "/opt/homebrew/bin/q2");
        assert_eq!(command.args, ["lsp"]);
        assert_eq!(command.env["PATH"], "/opt/homebrew/bin");
    }

    #[test]
    fn quarto2_prefers_the_quarto2_command() {
        let mut detected = quarto2_environment();
        detected.quarto2 = Some("/usr/local/bin/quarto2".into());
        let command = resolve_quarto2_launch(LaunchSettings::default(), detected).unwrap();
        assert_eq!(command.command, "/usr/local/bin/quarto2");
    }

    #[test]
    fn quarto2_explicit_binary_has_highest_precedence() {
        let mut detected = quarto2_environment();
        detected.quarto2 = Some("/usr/local/bin/quarto2".into());
        let command = resolve_quarto2_launch(
            LaunchSettings {
                path: Some("/custom/q2".into()),
                arguments: Some(vec!["lsp".into(), "-v".into()]),
                env: BTreeMap::from([("RUST_LOG".into(), "debug".into())]),
            },
            detected,
        )
        .unwrap();
        assert_eq!(command.command, "/custom/q2");
        assert_eq!(command.args, ["lsp", "-v"]);
        assert_eq!(command.env["RUST_LOG"], "debug");
        assert!(command.env.contains_key("PATH"));
    }

    #[test]
    fn missing_quarto2_names_how_to_install_configure_and_turn_it_off() {
        let error =
            resolve_quarto2_launch(LaunchSettings::default(), Quarto2Environment::default())
                .unwrap_err();
        assert!(error.contains("brew install quarto-dev/tap/q2"));
        assert!(error.contains("lsp.quarto2-lsp.binary.path"));
        assert!(error.contains("!quarto2-lsp"));
    }

    #[test]
    fn missing_binary_returns_actionable_error() {
        let error = resolve_launch(
            Process::LanguageServer,
            LaunchSettings::default(),
            LaunchEnvironment::default(),
        )
        .unwrap_err();
        assert!(error.contains("Install `avenger`"));
        assert!(error.contains("lsp.avenger-lsp.binary.path"));
    }

    #[test]
    fn monorepo_detection_requires_workspace_and_cli_member() {
        assert!(is_avenger_monorepo(
            "[workspace]\nmembers = [\"avenger-cli\"]"
        ));
        assert!(!is_avenger_monorepo("[package]\nname = \"avenger-cli\""));
    }

    /// The debugger is found as the language server is, and runs `avenger dap`.
    #[test]
    fn debugger_search_follows_the_language_servers_order() {
        let debugger = |path: Option<&str>, detected| {
            resolve_launch(
                Process::Debugger,
                LaunchSettings {
                    path: path.map(Into::into),
                    ..LaunchSettings::default()
                },
                detected,
            )
        };
        let mut checkout = environment();
        checkout.is_avenger_monorepo = true;
        checkout.release_avenger = Some("/workspace/target/release/avenger".into());

        let command = debugger(Some("/custom/avenger"), checkout.clone()).unwrap();
        assert_eq!(command.command, "/custom/avenger");
        assert_eq!(command.args, ["dap"]);

        let command = debugger(None, checkout).unwrap();
        assert_eq!(command.command, "/workspace/target/release/avenger");
        assert_eq!(command.args, ["dap"]);

        let command = debugger(None, environment()).unwrap();
        assert_eq!(command.command, "/usr/local/bin/avenger");
        assert_eq!(command.args, ["dap"]);
        assert_eq!(command.env["RUST_LOG"], "info");
    }

    #[test]
    fn missing_debugger_names_the_debugger_and_its_setting() {
        let error = resolve_launch(
            Process::Debugger,
            LaunchSettings::default(),
            LaunchEnvironment::default(),
        )
        .unwrap_err();
        assert!(error.contains("Avenger debugger not found"));
        assert!(error.contains("dap.avenger.binary"));

        let checkout = LaunchEnvironment {
            is_avenger_monorepo: true,
            ..LaunchEnvironment::default()
        };
        let error =
            resolve_launch(Process::Debugger, LaunchSettings::default(), checkout).unwrap_err();
        assert!(error.contains("start the debug session again"));
    }

    #[test]
    fn every_session_launches() {
        let mut extension = AvengerExtension;
        for config in [
            json!({ "target": "charts/x.av.sql" }),
            json!({ "request": "launch", "target": "charts/x.av.sql" }),
        ] {
            assert!(matches!(
                extension.dap_request_kind("avenger".into(), config),
                Ok(StartDebuggingRequestArgumentsRequest::Launch)
            ));
        }
        assert!(
            extension
                .dap_request_kind("avenger".into(), json!({ "request": "attach" }))
                .is_err()
        );
        assert!(
            extension
                .dap_request_kind("other".into(), json!({ "target": "x" }))
                .is_err()
        );
    }

    fn dialog(program: &str, args: &[&str], stop_on_entry: Option<bool>) -> DebugConfig {
        DebugConfig {
            label: "Debug origins".into(),
            adapter: "avenger".into(),
            request: DebugRequest::Launch(zed::LaunchRequest {
                program: program.into(),
                cwd: None,
                args: args.iter().map(|arg| (*arg).into()).collect(),
                envs: Vec::new(),
            }),
            stop_on_entry,
        }
    }

    fn config_of(scenario: &DebugScenario) -> Value {
        serde_json::from_str(&scenario.config).unwrap()
    }

    #[test]
    fn dialog_program_is_the_target() {
        let scenario = AvengerExtension
            .dap_config_to_scenario(dialog("charts/origins.av.sql", &[], Some(true)))
            .unwrap();
        assert_eq!(scenario.label, "Debug origins");
        assert_eq!(scenario.adapter, "avenger");
        assert!(scenario.build.is_none());
        assert_eq!(
            config_of(&scenario),
            json!({ "request": "launch", "target": "charts/origins.av.sql", "stopOnEntry": true })
        );
    }

    #[test]
    fn dialog_line_argument_targets_its_statement() {
        let scenario = AvengerExtension
            .dap_config_to_scenario(dialog("report.av.qmd", &["16"], None))
            .unwrap();
        assert_eq!(
            config_of(&scenario),
            json!({ "request": "launch", "target": "report.av.qmd:16" })
        );
        let scenario = AvengerExtension
            .dap_config_to_scenario(dialog("report.av.qmd#2", &["--json"], None))
            .unwrap();
        assert_eq!(config_of(&scenario)["target"], "report.av.qmd#2");
    }

    #[test]
    fn dialog_attach_is_refused() {
        let mut config = dialog("charts/origins.av.sql", &[], None);
        config.request = DebugRequest::Attach(zed::AttachRequest {
            process_id: Some(1),
        });
        assert!(AvengerExtension.dap_config_to_scenario(config).is_err());
    }

    /// The run arrows' task of `languages/avenger-sql/tasks.json`.
    fn arrows_task() -> TaskTemplate {
        let tasks: Value =
            serde_json::from_str(include_str!("../languages/avenger-sql/tasks.json")).unwrap();
        let task = &tasks[0];
        let strings = |value: &Value| -> Vec<String> {
            value
                .as_array()
                .unwrap()
                .iter()
                .map(|arg| arg.as_str().unwrap().to_owned())
                .collect()
        };
        TaskTemplate {
            label: task["label"].as_str().unwrap().into(),
            command: task["command"].as_str().unwrap().into(),
            args: strings(&task["args"]),
            env: Vec::new(),
            cwd: task["cwd"].as_str().map(Into::into),
        }
    }

    fn locate(task: TaskTemplate) -> Option<DebugScenario> {
        AvengerExtension.dap_locator_create_scenario(
            "avenger".into(),
            task,
            "Avenger: View charts/origins.av.sql".into(),
            "avenger".into(),
        )
    }

    #[test]
    fn locator_debugs_the_run_arrows_task() {
        let scenario = locate(arrows_task()).unwrap();
        assert_eq!(scenario.label, "Avenger: View charts/origins.av.sql");
        assert_eq!(scenario.adapter, "avenger");
        assert!(scenario.build.is_none());
        assert_eq!(
            config_of(&scenario),
            json!({ "request": "launch", "target": "$ZED_FILE:$ZED_ROW" })
        );
    }

    #[test]
    fn locator_takes_a_projects_avenger_binary() {
        let mut task = arrows_task();
        task.command = "target/release/avenger".into();
        task.args = ["view", "--color-scheme", "dark", "$ZED_FILE:$ZED_ROW"]
            .map(Into::into)
            .into();
        let scenario = locate(task).unwrap();
        assert_eq!(config_of(&scenario)["target"], "$ZED_FILE:$ZED_ROW");

        let mut task = arrows_task();
        task.command = "C:\\avenger\\target\\release\\avenger.exe".into();
        assert!(locate(task).is_some());
    }

    #[test]
    fn locator_refuses_other_tasks() {
        let mut task = arrows_task();
        task.args = ["render", "$ZED_FILE"].map(Into::into).into();
        assert!(locate(task).is_none());

        let mut task = arrows_task();
        task.command = "cargo".into();
        task.args = ["run", "view"].map(Into::into).into();
        assert!(locate(task).is_none());

        let mut task = arrows_task();
        task.command = "not-avenger".into();
        assert!(locate(task).is_none());

        let mut task = arrows_task();
        task.args = vec!["view".into()];
        assert!(locate(task).is_none());

        assert!(
            AvengerExtension
                .dap_locator_create_scenario(
                    "other".into(),
                    arrows_task(),
                    "label".into(),
                    "avenger".into(),
                )
                .is_none()
        );
        assert!(
            AvengerExtension
                .run_dap_locator("avenger".into(), arrows_task())
                .is_err()
        );
    }
}
