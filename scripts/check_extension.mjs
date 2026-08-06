import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = path => readFileSync(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const manifest = read("extension.toml");
for (const expected of [
  'id = "avenger"',
  'name = "Avenger"',
  'version = "0.1.0"',
  'repository = "https://github.com/avenger-vis/avenger-zed"',
  '[grammars.avenger]',
  'repository = "https://github.com/avenger-vis/tree-sitter-avenger"',
  '[language_servers.avenger-lsp]',
  'name = "Avenger Language Server"',
  'languages = ["Avenger"]',
  'language_ids = { Avenger = "avenger" }',
]) assert(manifest.includes(expected), `extension.toml is missing ${expected}`);
assert(/^rev = "[0-9a-f]{40}"$/m.test(manifest), "grammar revision must be a full SHA");
const grammarRevision = manifest.match(/^rev = "([0-9a-f]{40})"$/m)[1];
assert(!manifest.includes("file://"), "publishable manifest must not use file://");
assert((manifest.match(/^\[grammars\./gm) ?? []).length === 1, "register exactly one grammar");
assert(
  read(".github/workflows/ci.yml").includes(`ref: ${grammarRevision}`),
  "CI grammar checkout must match extension.toml",
);

const config = read("languages/avenger/config.toml");
for (const expected of [
  'grammar = "avenger"',
  'path_suffixes = ["avenger"]',
  'line_comments = ["-- "]',
  "tab_size = 2",
  "hard_tabs = false",
]) assert(config.includes(expected), `config.toml is missing ${expected}`);
for (const forbidden of ["avgr", '"//', '"#']) {
  assert(!config.includes(forbidden), `config.toml contains unsupported ${forbidden}`);
}

const required = [
  "LICENSE",
  "PUBLISHING.md",
  "README.md",
  "Cargo.toml",
  "Cargo.lock",
  "src/lib.rs",
  "languages/avenger/highlights.scm",
  "languages/avenger/brackets.scm",
  "languages/avenger/indents.scm",
  "languages/avenger/outline.scm",
  "languages/avenger/runnables.scm",
  "languages/avenger/tasks.json",
  "scripts/check_query_contract.mjs",
  "scripts/measure_queries.mjs",
  "test/metrics/query-performance-macos-arm64-2026-07-21.json",
  "test/metrics/query-performance-macos-arm64-2026-07-24.json",
];
for (const path of required) assert(existsSync(resolve(root, path)), `missing ${path}`);
for (const name of readdirSync(resolve(root, "test/fixtures"))) {
  assert(
    !/\.(?:data|mark|tool|transform)\.avenger$/.test(name),
    `fixture ${name} retains an obsolete role-specific suffix`,
  );
}
assert(execFileSync("git", ["ls-files", "extension.wasm"], { cwd: root, encoding: "utf8" }).trim() === "",
  "compiled extension.wasm must not be committed");
const cargo = read("Cargo.toml");
assert(cargo.includes('crate-type = ["cdylib", "rlib"]'), "extension must build as a cdylib");
assert(cargo.includes('zed_extension_api = "=0.7.0"'), "Zed extension API must be exactly pinned");
const adapter = read("src/lib.rs");
for (const expected of [
  "language_server_command",
  "LspSettings::for_worktree",
  'worktree.which("target/release/avenger")',
  'worktree.which("avenger")',
  "worktree.shell_env()",
]) assert(adapter.includes(expected), `LSP adapter is missing ${expected}`);
assert(!adapter.includes('worktree.which("cargo")'), "LSP adapter must not launch through Cargo");
for (const forbidden of ["download_file(", "latest_github_release(", "label_for_completion", "label_for_symbol"]) {
  assert(!adapter.includes(forbidden), `LSP adapter contains out-of-scope behavior ${forbidden}`);
}
assert(read(".gitignore").split(/\r?\n/).includes("grammars/"), "Zed's generated grammar checkout must be ignored");
assert(execFileSync("git", ["ls-files", "grammars"], { cwd: root, encoding: "utf8" }).trim() === "",
  "configuration-only extension must not track generated grammars");

const captureContracts = new Map([
  ["highlights.scm", new Set([
    "attribute", "boolean", "comment", "comment.doc", "constant", "function", "keyword",
    "namespace",
    "number", "operator", "property", "punctuation.bracket", "punctuation.delimiter",
    "punctuation.special", "string", "string.escape", "string.special", "type",
    "type.builtin", "variable", "variable.parameter", "variable.special",
  ])],
  ["brackets.scm", new Set(["open", "close"])],
  ["indents.scm", new Set(["indent", "end"])],
  ["outline.scm", new Set(["item", "name", "context", "context.extra", "annotation"])],
  ["runnables.scm", new Set(["run", "avenger_chart"])],
]);
for (const [name, allowed] of captureContracts) {
  const source = read(`languages/avenger/${name}`);
  for (const capture of source.matchAll(/@([A-Za-z_][A-Za-z0-9_.]*)/g)) {
    if (capture[1].startsWith("_")) continue;
    assert(allowed.has(capture[1]), `${name} uses unsupported capture @${capture[1]}`);
  }
}

const tasks = JSON.parse(read("languages/avenger/tasks.json"));
assert(Array.isArray(tasks) && tasks.length === 2, "tasks.json must contain named and anonymous tasks");
const [namedTask, anonymousTask] = tasks;
assert(
  namedTask.label === "Avenger: Watch $ZED_CUSTOM_avenger_chart ($ZED_RELATIVE_FILE)",
  "named task label must identify the exact chart",
);
assert(namedTask.command === "target/release/avenger", "named task must use the release binary");
assert(JSON.stringify(namedTask.args) === JSON.stringify([
  "watch", "$ZED_FILE", "--chart", "$ZED_CUSTOM_avenger_chart",
  "--project-root", "$ZED_WORKTREE_ROOT",
]), "named development task arguments changed");
assert(JSON.stringify(namedTask.tags) === JSON.stringify(["avenger-watch-named"]), "named task tag changed");

assert(
  anonymousTask.label === "Avenger: Watch anonymous chart ($ZED_RELATIVE_FILE)",
  "anonymous task label changed",
);
assert(anonymousTask.command === "target/release/avenger", "anonymous task must use the release binary");
assert(JSON.stringify(anonymousTask.args) === JSON.stringify([
  "watch", "$ZED_FILE", "--project-root", "$ZED_WORKTREE_ROOT",
]), "anonymous development task arguments changed");
assert(
  JSON.stringify(anonymousTask.tags) === JSON.stringify(["avenger-watch-anonymous"]),
  "anonymous task tag changed",
);

for (const task of tasks) {
  assert(task.cwd === "$ZED_WORKTREE_ROOT", "task cwd must be the worktree root");
  assert(task.use_new_terminal === false && task.allow_concurrent_runs === true, "task rerun policy changed");
  assert(task.reveal === "no_focus" && task.hide === "never" && task.save === "all", "task UI/save policy changed");
}
const runnables = read("languages/avenger/runnables.scm");
assert(runnables.includes("(#set! tag avenger-watch-named)"), "named runnable tag changed");
assert(runnables.includes("(#set! tag avenger-watch-anonymous)"), "anonymous runnable tag changed");
assert(runnables.includes("@avenger_chart"), "named runnable must expose the chart binder");

const skippedDirectories = new Set([".git", ".tmp", "grammars", "node_modules"]);
const walk = directory => readdirSync(directory).flatMap(name => {
  const path = resolve(directory, name);
  return statSync(path).isDirectory()
    ? (skippedDirectories.has(name) ? [] : walk(path))
    : [path];
});
const localPaths = walk(root);
assert(read(".gitignore").split(/\r?\n/).includes("extension.wasm"), "Zed's generated extension.wasm must be ignored");

console.log("extension package contract is valid");
