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
  "tab_size = 4",
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

// Run arrows: each tag of runnables.scm has a task, which opens `avenger view` on the statement at
// the arrow's line, one window for each file.
const tags = [...read("languages/avenger-sql/runnables.scm").matchAll(/#set! tag ([A-Za-z0-9_-]+)/g)].map(m => m[1]);
const tasks = JSON.parse(read("languages/avenger-sql/tasks.json"));
assert(tags.length > 0, "runnables.scm sets no tag");
for (const tag of tags) {
  const task = tasks.find(task => task.tags?.includes(tag));
  assert(task, `no task of tasks.json has the tag ${tag} of runnables.scm`);
  if (!task) continue;
  assert(task.command === "avenger", `the task of ${tag} must run avenger from PATH`);
  assert(
    JSON.stringify(task.args) === JSON.stringify(["view", "$ZED_FILE:$ZED_ROW"]),
    `the task of ${tag} must open avenger view on $ZED_FILE:$ZED_ROW`,
  );
  assert(!task.label.includes("$ZED_ROW"), `the task of ${tag} must keep one window for each file`);
  assert(task.use_new_terminal === false && task.allow_concurrent_runs === true, `the task of ${tag} must replace its window when it runs again`);
}

// Indentation: indents.scm captures the starts of queries that config.toml's `|>` rule aligns to,
// and config.toml's patterns match the lines they should. Zed compiles the patterns with Rust's
// `regex` in verbose mode, `(?x)`, which JavaScript lacks, so the check drops their comments and
// whitespace and reads `(?i)` as the `i` flag. The patterns use `\s` for every space they match.
const indents = read("languages/avenger-sql/indents.scm");
assert(indents.includes("@start.query"), "indents.scm must capture the starts of queries as @start.query");
assert(!/\(pipe_[a-z_]+[\s\S]*?\)\s*@indent/.test(indents), "indents.scm must give pipe operators no range");
assert(
  !/"[)\]]" @end/.test(indents),
  "indents.scm must leave a bracket's closer at its contents' depth, for the server's deletion to correct",
);
const toml = read("languages/avenger-sql/config.toml");
const literal = key => toml.match(new RegExp(`^${key} = '''([\\s\\S]*?)'''`, "m"))?.[1];
const toJs = source => {
  const flags = /^\(\?[a-z]*i[a-z]*\)/.test(source.trimStart()) ? "i" : "";
  const body = source
    .trimStart()
    .replace(/^\(\?[a-z]+\)/, "")
    .split("\n")
    .map(line => line.replace(/#.*$/, ""))
    .join("")
    .replace(/\s+/g, "");
  return new RegExp(body, flags);
};
const patterns = {
  increase: [
    literal("increase_indent_pattern"),
    [
      "|> AGGREGATE", "  |> aggregate ", "|> SELECT DISTINCT", "|> ORDER BY", "|> WHERE",
      "|> LEFT OUTER JOIN", "|> CROSS JOIN", "|> JOIN", "|> UNION ALL", "|> TABLESAMPLE",
      "|> SELECT a,", "|> AGGREGATE mark_bar(", "CREATE VIEW v AS (", "    x => [",
      "|> WHERE x AND", "|> WHERE x OR", "|> WHERE x >", "|> EXTEND CASE", "    a ||", "|> SELECT x /",
    ],
    [
      "|> WHERE x", "|> DISTINCT", "|> AS t", "|> SELECT a, b", "FROM t", "    count(*) AS n,",
      "|> WHERE brand", "|> WHERE x /* note */", "|> AGGREGATE COUNT(*) AS n", "|> LIMIT 10",
      "    AND y", "-- a comment", "   ) AS chart",
    ],
  ],
  decrease: [
    literal("decrease_indent_pattern"),
    ["END", "  end AS x", "    END"],
    ["|> WHERE x", ")", "   ) AS chart", "]", "ENDING", "    a,"],
  ],
  pipe: [
    toml.match(/pattern = '''(.*?)''', valid_after = \["query"\]/)?.[1],
    ["|> WHERE x", "    |> AGGREGATE", "|>"],
    ["FROM t |> WHERE x", "    AND y", "-- |> a comment"],
  ],
};
for (const [name, [source, should, shouldNot]] of Object.entries(patterns)) {
  assert(source, `config.toml has no ${name} pattern`);
  if (!source) continue;
  const regex = toJs(source);
  for (const line of should) assert(regex.test(line), `the ${name} pattern must match ${JSON.stringify(line)}`);
  for (const line of shouldNot) assert(!regex.test(line), `the ${name} pattern must not match ${JSON.stringify(line)}`);
}
assert(/^tab_size = 4$/m.test(toml), "config.toml's tab_size must be 4, the style's unit");

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
