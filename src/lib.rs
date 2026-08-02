use std::collections::BTreeMap;

use zed::settings::LspSettings;
use zed_extension_api as zed;

const LANGUAGE_SERVER_NAME: &str = "avenger-lsp";

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
        validate_language_server_id(language_server_id)?;
        let settings = LspSettings::for_worktree(LANGUAGE_SERVER_NAME, worktree)?;
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
        let is_avenger_monorepo = worktree
            .read_text_file("Cargo.toml")
            .is_ok_and(|manifest| is_avenger_monorepo(&manifest));
        let launch = resolve_launch(
            LaunchSettings {
                path,
                arguments,
                env,
            },
            LaunchEnvironment {
                is_avenger_monorepo,
                release_avenger: is_avenger_monorepo
                    .then(|| worktree.which("target/release/avenger"))
                    .flatten(),
                avenger: worktree.which("avenger"),
                shell_env: worktree.shell_env().into_iter().collect(),
            },
        )?;
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
        validate_language_server_id(language_server_id)?;
        Ok(LspSettings::for_worktree(LANGUAGE_SERVER_NAME, worktree)?.initialization_options)
    }

    fn language_server_workspace_configuration(
        &mut self,
        language_server_id: &zed::LanguageServerId,
        worktree: &zed::Worktree,
    ) -> zed::Result<Option<zed::serde_json::Value>> {
        validate_language_server_id(language_server_id)?;
        Ok(LspSettings::for_worktree(LANGUAGE_SERVER_NAME, worktree)?.settings)
    }
}

zed::register_extension!(AvengerExtension);

fn validate_language_server_id(id: &zed::LanguageServerId) -> zed::Result<()> {
    if id.as_ref() == LANGUAGE_SERVER_NAME {
        Ok(())
    } else {
        Err(format!("unsupported language server `{id}`"))
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

fn resolve_launch(
    settings: LaunchSettings,
    environment: LaunchEnvironment,
) -> Result<LaunchCommand, String> {
    let explicit_path = settings.path.filter(|path| !path.trim().is_empty());
    let (command, default_args) = if let Some(path) = explicit_path {
        (path, vec!["lsp".to_owned()])
    } else if environment.is_avenger_monorepo {
        let release_avenger = environment.release_avenger.ok_or_else(|| {
            "Avenger release binary not found at `target/release/avenger`. Run \
             `cargo build --release -p avenger-lang-cli --bin avenger` from the Avenger \
             repository, then restart the language server."
                .to_owned()
        })?;
        (release_avenger, vec!["lsp".to_owned()])
    } else if let Some(avenger) = environment.avenger {
        (avenger, vec!["lsp".to_owned()])
    } else {
        return Err(
            "Avenger language server not found. Install `avenger` on PATH or configure \
             `lsp.avenger-lsp.binary.path` in Zed settings."
                .to_owned(),
        );
    };

    let mut env = environment.shell_env;
    env.extend(settings.env);
    Ok(LaunchCommand {
        command,
        args: settings.arguments.unwrap_or(default_args),
        env,
    })
}

fn is_avenger_monorepo(manifest: &str) -> bool {
    manifest.contains("avenger-lang-cli") && manifest.contains("[workspace]")
}

#[cfg(test)]
mod tests {
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
        let command = resolve_launch(LaunchSettings::default(), detected).unwrap();
        assert_eq!(command.command, "/workspace/target/release/avenger");
        assert_eq!(command.args, ["lsp"]);
    }

    #[test]
    fn monorepo_without_release_binary_returns_build_guidance() {
        let mut detected = environment();
        detected.is_avenger_monorepo = true;
        let error = resolve_launch(LaunchSettings::default(), detected).unwrap_err();
        assert!(error.contains("target/release/avenger"));
        assert!(error.contains("cargo build --release -p avenger-lang-cli --bin avenger"));
    }

    #[test]
    fn ordinary_project_uses_avenger_from_shell_path() {
        let command = resolve_launch(LaunchSettings::default(), environment()).unwrap();
        assert_eq!(command.command, "/usr/local/bin/avenger");
        assert_eq!(command.args, ["lsp"]);
    }

    #[test]
    fn missing_binary_returns_actionable_error() {
        let error =
            resolve_launch(LaunchSettings::default(), LaunchEnvironment::default()).unwrap_err();
        assert!(error.contains("Install `avenger`"));
        assert!(error.contains("lsp.avenger-lsp.binary.path"));
    }

    #[test]
    fn monorepo_detection_requires_workspace_and_cli_member() {
        assert!(is_avenger_monorepo(
            "[workspace]\nmembers = [\"avenger-lang-cli\"]"
        ));
        assert!(!is_avenger_monorepo(
            "[package]\nname = \"avenger-lang-cli\""
        ));
    }
}
