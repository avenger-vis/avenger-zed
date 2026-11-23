// Checks the extension's package: the manifest and its grammars, the languages and the grammars
// they name, that every language that an injection names resolves in Zed, the language server
// adapter, and the files that Zed builds and must not be committed.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, relative, resolve } from "node:path";

import { grammars, languages, root } from "./grammars.mjs";

const read = path => readFileSync(resolve(root, path), "utf8");
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

// The manifest.
const manifest = read("extension.toml");
for (const expected of [
  'id = "avenger"',
  'name = "Avenger"',
  'version = "0.1.0"',
  'repository = "https://github.com/avenger-vis/avenger-zed"',
  "[language_servers.avenger-lsp]",
  'languages = ["Avenger SQL", "Quarto"]',
  'language_ids = { "Avenger SQL" = "avenger-sql", Quarto = "quarto" }',
]) assert(manifest.includes(expected), `extension.toml is missing ${expected}`);
assert(!manifest.includes("file://"), "extension.toml must not name a file:// repository");

// The grammars: avenger-sql's three grammars come from one revision of their repository, and CI
// checks out each repository at its revision.
const pinned = grammars();
const byName = new Map(pinned.map(grammar => [grammar.name, grammar]));
assert(
  JSON.stringify([...byName.keys()]) === JSON.stringify(["avenger_sql", "avenger_format", "avenger_datetime", "avenger_typst"]),
  `extension.toml's grammars are ${[...byName.keys()].join(", ")}`,
);
const revisions = new Map();
for (const grammar of pinned) {
  const other = revisions.get(grammar.repository);
  assert(!other || other === grammar.rev, `the grammars of ${grammar.repository} pin different revisions`);
  revisions.set(grammar.repository, grammar.rev);
}
const ci = read(".github/workflows/ci.yml");
for (const [repository, rev] of revisions) {
  const name = new URL(repository).pathname.slice(1);
  assert(
    ci.includes(`repository: ${name}\n          ref: ${rev}\n          path: ${basename(repository)}`),
    `CI must check out ${name} at ${rev} into ${basename(repository)}`,
  );
}

// The languages: each names a grammar of the manifest, every grammar has a language, and only
// Avenger SQL is visible, since the others are only injected.
const found = languages();
for (const language of found) {
  assert(byName.has(language.grammar), `${language.name} names the grammar ${language.grammar}, which extension.toml lacks`);
  assert(language.hidden === (language.name !== "Avenger SQL"), `${language.name} must ${language.hidden ? "not " : ""}be hidden`);
}
for (const grammar of pinned) {
  assert(found.some(language => language.grammar === grammar.name), `no language uses the grammar ${grammar.name}`);
}
const sql = read("languages/avenger-sql/config.toml");
for (const expected of [
  'path_suffixes = ["av.sql", "av.sqlm", "avenger-sql"]',
  'line_comments = ["-- "]',
  "tab_size = 2",
  "hard_tabs = false",
]) assert(sql.includes(expected), `languages/avenger-sql/config.toml is missing ${expected}`);

// Zed finds an injected language by its name or a file suffix of a language: one of the
// extension's, or one that Zed bundles.
const BUNDLED = new Set(["json", "regex"]);
const resolves = name =>
  BUNDLED.has(name) || found.some(language => language.name === name || language.suffixes.includes(name));
for (const language of found) {
  const path = resolve(language.directory, "injections.scm");
  if (!existsSync(path)) continue;
  const names = new Set([...readFileSync(path, "utf8").matchAll(/#set! injection\.language "([^"]+)"/g)].map(m => m[1]));
  for (const name of names) {
    assert(resolves(name), `${relative(root, path)} injects ${name}, which no language resolves`);
  }
}

// Semantic token rules.
const rules = JSON.parse(read("languages/avenger-sql/semantic_token_rules.json"));
assert(Array.isArray(rules) && rules.every(rule => typeof rule.token_type === "string"), "semantic_token_rules.json must be a list of rules with token types");

// The language server adapter.
for (const path of ["LICENSE", "PUBLISHING.md", "README.md", "Cargo.toml", "Cargo.lock", "src/lib.rs"]) {
  assert(existsSync(resolve(root, path)), `missing ${path}`);
}
const cargo = read("Cargo.toml");
assert(cargo.includes('crate-type = ["cdylib", "rlib"]'), "the extension must build as a cdylib");
assert(cargo.includes('zed_extension_api = "=0.7.0"'), "the Zed extension API must be pinned exactly");
const adapter = read("src/lib.rs");
for (const expected of [
  "language_server_command",
  "LspSettings::for_worktree",
  'worktree.which("target/release/avenger")',
  'worktree.which("avenger")',
  "worktree.shell_env()",
]) assert(adapter.includes(expected), `the adapter is missing ${expected}`);
assert(!adapter.includes('worktree.which("cargo")'), "the adapter must not start the server through Cargo");
for (const forbidden of ["download_file(", "latest_github_release("]) {
  assert(!adapter.includes(forbidden), `the adapter must not download the server (${forbidden})`);
}

// Line endings: the grammars' repositories check out with LF, so the copies of their queries,
// and the files that the scripts read, must too, also on Windows.
assert(read(".gitattributes").split(/\r?\n/).includes("* text eol=lf"), ".gitattributes must check out text with LF");

// Files that Zed builds.
const ignored = read(".gitignore").split(/\r?\n/);
const tracked = path => execFileSync("git", ["ls-files", path], { cwd: root, encoding: "utf8" }).trim() !== "";
for (const path of ["extension.wasm", "grammars/"]) {
  assert(ignored.includes(path), `.gitignore must ignore ${path}`);
  assert(!tracked(path), `${path} must not be committed`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("the extension's package is valid");
