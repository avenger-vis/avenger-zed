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
]) assert(manifest.includes(expected), `extension.toml is missing ${expected}`);
assert(/^rev = "[0-9a-f]{40}"$/m.test(manifest), "grammar revision must be a full SHA");
assert(!manifest.includes("file://"), "publishable manifest must not use file://");
assert((manifest.match(/^\[grammars\./gm) ?? []).length === 1, "register exactly one grammar");

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
  "README.md",
  "languages/avenger/highlights.scm",
  "languages/avenger/brackets.scm",
  "languages/avenger/indents.scm",
  "languages/avenger/outline.scm",
  "languages/avenger/runnables.scm",
  "languages/avenger/tasks.json",
  "scripts/measure_queries.mjs",
  "test/metrics/query-performance-macos-arm64-2026-07-21.json",
];
for (const path of required) assert(existsSync(resolve(root, path)), `missing ${path}`);
for (const forbidden of ["Cargo.toml", "Cargo.lock", "src/lib.rs", "extension.wasm"]) {
  assert(!existsSync(resolve(root, forbidden)), `configuration-only extension must not contain ${forbidden}`);
}
assert(read(".gitignore").split(/\r?\n/).includes("grammars/"), "Zed's generated grammar checkout must be ignored");
assert(execFileSync("git", ["ls-files", "grammars"], { cwd: root, encoding: "utf8" }).trim() === "",
  "configuration-only extension must not track generated grammars");

const captureContracts = new Map([
  ["highlights.scm", new Set([
    "attribute", "boolean", "comment", "comment.doc", "constant", "function", "keyword",
    "number", "operator", "property", "punctuation.bracket", "punctuation.delimiter",
    "punctuation.special", "string", "string.escape", "string.special", "type",
    "type.builtin", "variable", "variable.parameter", "variable.special",
  ])],
  ["brackets.scm", new Set(["open", "close"])],
  ["indents.scm", new Set(["indent", "end"])],
  ["outline.scm", new Set(["item", "name", "context", "context.extra", "annotation"])],
  ["runnables.scm", new Set(["run"])],
]);
for (const [name, allowed] of captureContracts) {
  const source = read(`languages/avenger/${name}`);
  for (const capture of source.matchAll(/@([A-Za-z_][A-Za-z0-9_.]*)/g)) {
    assert(allowed.has(capture[1]), `${name} uses unsupported capture @${capture[1]}`);
  }
}

const tasks = JSON.parse(read("languages/avenger/tasks.json"));
assert(Array.isArray(tasks) && tasks.length === 1, "tasks.json must contain one task");
const task = tasks[0];
assert(task.label === "Avenger: Watch $ZED_RELATIVE_FILE", "task label must identify the chart");
assert(task.command === "cargo", "development task must use cargo");
assert(JSON.stringify(task.args) === JSON.stringify([
  "run", "--release", "-p", "avenger-lang-cli", "--bin", "avenger", "--", "watch", "$ZED_FILE",
]), "development task arguments changed");
assert(task.cwd === "$ZED_WORKTREE_ROOT", "task cwd must be the worktree root");
assert(JSON.stringify(task.tags) === JSON.stringify(["avenger-watch"]), "task tag changed");
assert(task.use_new_terminal === false && task.allow_concurrent_runs === true, "task rerun policy changed");
assert(task.reveal === "no_focus" && task.hide === "never" && task.save === "all", "task UI/save policy changed");
assert(read("languages/avenger/runnables.scm").includes("(#set! tag avenger-watch)"), "runnable tag changed");

const skippedDirectories = new Set([".git", ".tmp", "grammars", "node_modules"]);
const walk = directory => readdirSync(directory).flatMap(name => {
  const path = resolve(directory, name);
  return statSync(path).isDirectory()
    ? (skippedDirectories.has(name) ? [] : walk(path))
    : [path];
});
const localPaths = walk(root);
assert(!localPaths.some(path => path.endsWith("extension.wasm")), "extension.wasm must not be committed");

console.log("extension package contract is valid");
