// Checks the extension's package: the manifest and its grammars, the languages and the grammars
// they name, that every language that an injection names resolves in Zed, the language server
// adapter, the debug adapter and its locator, and the files that Zed builds and must not be
// committed.

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
  'languages = ["Avenger SQL", "Avenger Quarto", "Quarto"]',
  'language_ids = { "Avenger SQL" = "avenger-sql", "Avenger Quarto" = "quarto", Quarto = "quarto" }',
  // Quarto 2's server serves Avenger Quarto alone, so Quarto 1 documents take none of its errors.
  "[language_servers.quarto2-lsp]",
  'languages = ["Avenger Quarto"]',
  'language_ids = { "Avenger Quarto" = "quarto" }',
]) assert(manifest.includes(expected), `extension.toml is missing ${expected}`);
assert(!manifest.includes("file://"), "extension.toml must not name a file:// repository");

// The grammars: tree-sitter-avenger-sql's four grammars, avenger-sql's three and the vendored
// grammar of Quarto Markdown, come from one revision of their repository, and CI checks out each
// repository at its revision.
const pinned = grammars();
const byName = new Map(pinned.map(grammar => [grammar.name, grammar]));
assert(
  JSON.stringify([...byName.keys()]) === JSON.stringify(["avenger_sql", "avenger_format", "avenger_datetime", "avenger_qmd", "avenger_typst"]),
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
// Avenger SQL and Avenger Quarto are visible, since the others are only injected.
const VISIBLE = new Set(["Avenger SQL", "Avenger Quarto"]);
const found = languages();
for (const language of found) {
  assert(byName.has(language.grammar), `${language.name} names the grammar ${language.grammar}, which extension.toml lacks`);
  assert(language.hidden === !VISIBLE.has(language.name), `${language.name} must ${language.hidden ? "not " : ""}be hidden`);
}
for (const name of VISIBLE) assert(found.some(language => language.name === name), `no language is named ${name}`);
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
// Quarto 2 documents: `av.qmd`, longer than the `qmd` of other extensions' Quarto, so Zed opens
// them here whichever extension loads last, on the vendored grammar.
const quarto = read("languages/avenger-quarto/config.toml");
for (const expected of [
  'grammar = "avenger_qmd"',
  'path_suffixes = ["av.qmd"]',
]) assert(quarto.includes(expected), `languages/avenger-quarto/config.toml is missing ${expected}`);

// Zed finds an injected language by its name or a file suffix of a language: one of the
// extension's, one that Zed bundles, or one that one of Zed's extensions installs, which a
// document injects only when the user has the extension. A cell's own language, which its braces
// name, is the document's to resolve and isn't checked.
const BUNDLED = new Set(["json", "regex", "yaml", "html", "javascript"]);
const FROM_EXTENSIONS = new Set(["latex"]);
const resolves = name =>
  BUNDLED.has(name) ||
  FROM_EXTENSIONS.has(name) ||
  found.some(language => language.name === name || language.suffixes.includes(name));
for (const language of found) {
  const path = resolve(language.directory, "injections.scm");
  if (!existsSync(path)) continue;
  const names = new Set([...readFileSync(path, "utf8").matchAll(/#set! injection\.language "([^"]+)"/g)].map(m => m[1]));
  for (const name of names) {
    assert(resolves(name), `${relative(root, path)} injects ${name}, which no language resolves`);
  }
}

// Run arrows: each tag of a language's runnables.scm has a task of that language's tasks.json, which
// runs what the tag is for, one terminal for each file that a second run replaces: Avenger SQL's
// arrows open `avenger view` on the statement at the arrow's line, and Avenger Quarto's arrow
// previews the document with q2. A server such as q2's preview never exits, and a task that can't
// run concurrently would wait for it, so a second click replaces the running one.
const TASKS = {
  "avenger-view": { command: "avenger", args: ["view", "$ZED_FILE:$ZED_ROW"] },
  "quarto2-preview": { command: "q2", args: ["preview", "$ZED_FILE"] },
};
const runnables = { "avenger-sql": ["avenger-view"], "avenger-quarto": ["quarto2-preview"] };
for (const [language, expected] of Object.entries(runnables)) {
  const tags = [...read(`languages/${language}/runnables.scm`).matchAll(/#set! tag ([A-Za-z0-9_-]+)/g)].map(m => m[1]);
  const tasks = JSON.parse(read(`languages/${language}/tasks.json`));
  assert(JSON.stringify(tags) === JSON.stringify(expected), `languages/${language}/runnables.scm must set the tags ${expected.join(", ")}`);
  for (const tag of tags) {
    const task = tasks.find(task => task.tags?.includes(tag));
    assert(task, `no task of languages/${language}/tasks.json has the tag ${tag} of its runnables.scm`);
    if (!task || !TASKS[tag]) continue;
    assert(task.command === TASKS[tag].command, `the task of ${tag} must run ${TASKS[tag].command} from PATH`);
    assert(
      JSON.stringify(task.args) === JSON.stringify(TASKS[tag].args),
      `the task of ${tag} must run ${TASKS[tag].command} ${TASKS[tag].args.join(" ")}`,
    );
    assert(!task.label.includes("$ZED_ROW"), `the task of ${tag} must keep one terminal for each file`);
    assert(task.use_new_terminal === false && task.allow_concurrent_runs === true, `the task of ${tag} must replace its terminal when it runs again`);
  }
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

// Semantic token rules: lists of rules with token types. Avenger Quarto's style q2's own types, of
// the legend that the nightly's `q2 lsp` advertises (0.48.0-nightly.20261121), and Avenger SQL's.
const Q2_TOKEN_TYPES = new Set([
  "qmdHeading", "qmdEmphasis", "qmdStrong", "qmdStrikethrough", "qmdLinkText", "qmdLinkUrl",
  "qmdLinkTitle", "qmdImageText", "qmdImageUrl", "qmdInlineCode", "qmdCodeBlock", "qmdCodeInfo",
  "qmdMath", "qmdShortcode", "qmdListMarker", "qmdQuote", "qmdPunctuation", "qmdFence",
  "qmdFrontMatterFence", "qmdAttribute", "qmdBoolean", "qmdConstant", "qmdEmbedded", "qmdError",
  "qmdEscape", "qmdCodeMarkup", "qmdCodePunctuation", "qmdTag",
]);
const tokenRules = language => {
  const path = `languages/${language}/semantic_token_rules.json`;
  const rules = JSON.parse(read(path));
  assert(Array.isArray(rules) && rules.every(rule => typeof rule.token_type === "string"), `${path} must be a list of rules with token types`);
  return Array.isArray(rules) ? rules : [];
};
const sqlRules = tokenRules("avenger-sql");
const quartoRules = tokenRules("avenger-quarto");
for (const rule of quartoRules) {
  const own = rule.token_type.startsWith("qmd");
  assert(!own || Q2_TOKEN_TYPES.has(rule.token_type), `Avenger Quarto styles ${rule.token_type}, which q2's legend lacks`);
}
// A cell's code is colored by avenger's grammar and tokens, not by q2's whole code block.
assert(!quartoRules.some(rule => rule.token_type === "qmdCodeBlock"), "Avenger Quarto must not style qmdCodeBlock");
for (const rule of sqlRules) {
  assert(quartoRules.some(other => JSON.stringify(other) === JSON.stringify(rule)), `Avenger Quarto must carry Avenger SQL's rule of ${rule.token_type}, for the tokens of its cells`);
}

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
  'worktree.which("quarto2")',
  'worktree.which("q2")',
  "worktree.shell_env()",
]) assert(adapter.includes(expected), `the adapter is missing ${expected}`);
assert(!adapter.includes('worktree.which("cargo")'), "the adapter must not start the server through Cargo");
for (const forbidden of ["download_file(", "latest_github_release("]) {
  assert(!adapter.includes(forbidden), `the adapter must not download the server (${forbidden})`);
}

// The debug adapter: the manifest declares it, with its schema, and its locator; the schema is a
// JSON schema that requires the target; Avenger SQL names the adapter, so its run arrows offer
// Debug; and the extension implements the hooks of the adapter and the locator.
for (const expected of [
  "[debug_adapters.avenger]",
  'schema_path = "debug_adapter_schemas/avenger.json"',
  "[debug_locators.avenger]",
]) assert(manifest.includes(expected), `extension.toml is missing ${expected}`);
const schemaPath = "debug_adapter_schemas/avenger.json";
if (existsSync(resolve(root, schemaPath))) {
  let schema;
  try {
    schema = JSON.parse(read(schemaPath));
  } catch (error) {
    assert(false, `${schemaPath} is not valid JSON: ${error.message}`);
  }
  if (schema) {
    assert(schema.type === "object", `${schemaPath} must describe an object`);
    assert(schema.required?.includes("target"), `${schemaPath} must require target`);
    assert(schema.properties?.target?.type === "string", `${schemaPath}'s target must be a string`);
    assert(schema.properties?.stopOnEntry?.type === "boolean", `${schemaPath}'s stopOnEntry must be a boolean`);
  }
} else {
  assert(false, `missing ${schemaPath}`);
}
assert(/^debuggers = \["avenger"\]$/m.test(sql), 'languages/avenger-sql/config.toml must name the debugger, debuggers = ["avenger"]');
assert(/^debuggers = \["avenger"\]$/m.test(quarto), 'languages/avenger-quarto/config.toml must name the debugger, debuggers = ["avenger"]');
for (const hook of [
  "fn get_dap_binary(",
  "fn dap_request_kind(",
  "fn dap_config_to_scenario(",
  "fn dap_locator_create_scenario(",
  "fn run_dap_locator(",
]) assert(adapter.includes(hook), `the extension must implement ${hook.slice(3, -1)}`);

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
