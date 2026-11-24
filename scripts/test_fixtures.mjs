// Parses the scripts of test/smoke/, the files of the manual checks in Zed and of its project
// `vega/`, with the grammar of Avenger SQL at its pinned revision, and runs the language's queries
// over each. A script parses without errors, except `reserved.av.sql`, whose reserved words are
// errors on purpose, and each query compiles against the grammar.
//
// The run arrows of `runnables.scm` are written to test/output/runnables.txt, a line of each
// script with the lines of its arrows, and the ranges of `indents.scm` to test/output/indents.txt,
// and each is compared with its file in test/expected/, which a change accepts by copying the
// output over it.
//
// Usage: node scripts/test_fixtures.mjs [--grammars DIR]

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { checkout, grammars, languages, root } from "./grammars.mjs";

const executable = process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter";
const treeSitter = [process.env.TREE_SITTER, resolve(root, "node_modules", ".bin", executable)]
  .filter(Boolean)
  .find(existsSync);
if (!treeSitter) throw new Error("no tree-sitter CLI; run pnpm install or set TREE_SITTER");

const language = languages().find(language => language.name === "Avenger SQL");
const grammar = grammars().find(grammar => grammar.name === language.grammar);
const directory = checkout(grammar);
const run = args =>
  spawnSync(treeSitter, args, {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    shell: process.platform === "win32",
  });

// The scripts and modules under a directory, by their paths from it, in order.
const walk = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /\.av\.sqlm?$/.test(entry.name) ? [path] : [];
  });

const ERRORS_ON_PURPOSE = new Set(["reserved.av.sql"]);
const smoke = resolve(root, "test", "smoke");
const scripts = walk(smoke)
  .map(path => relative(smoke, path).replaceAll("\\", "/"))
  .sort();
const queries = readdirSync(language.directory)
  .filter(name => name.endsWith(".scm"))
  .sort();
const failures = [];
const arrows = [];
const indentLines = [];

// The indentation that indents.scm gives a script, from the matches that `tree-sitter query`
// prints: each range that Zed indents, from the row of its node's start to the row of its `@end`,
// or of its node's end without one,
// and each query's start, which a `|>` goes back to. Zed skips a range that starts and ends on one
// row, so these leave it out.
function indentRanges(stdout) {
  const items = [];
  for (const match of stdout.split(/\n\s*pattern: \d+\n/).slice(1)) {
    const rows = {};
    const ends = {};
    for (const capture of match.matchAll(/capture: (?:\d+ - )?([a-z.]+), start: \((\d+), \d+\), end: \((\d+), \d+\)/g)) {
      rows[capture[1]] ??= Number(capture[2]) + 1;
      ends[capture[1]] ??= Number(capture[3]) + 1;
    }
    // A range ends at its `@end`'s start, or without one, at its node's end, as Zed takes it.
    const end = rows.end ?? ends.indent;
    if (rows.indent !== undefined && end > rows.indent) items.push(`${rows.indent}-${end}`);
    if (rows["start.query"] !== undefined) items.push(`query ${rows["start.query"]}`);
  }
  return items.length > 0 ? items.join(", ") : "none";
}
for (const name of scripts) {
  const path = resolve(smoke, name);
  const parsed = run(["parse", "--quiet", path]);
  const expected = ERRORS_ON_PURPOSE.has(name.split("/").pop()) ? 1 : 0;
  if (parsed.status !== expected) {
    failures.push(`${name}: tree-sitter parse exited ${parsed.status}, expected ${expected}\n${parsed.stdout}${parsed.stderr}`);
  }
  for (const query of queries) {
    const result = run(["query", "--captures", resolve(language.directory, query), path]);
    if (result.status !== 0) {
      failures.push(`${query} over ${name}: exited ${result.status}\n${result.stderr}`);
      continue;
    }
    if (query === "runnables.scm") {
      // A capture prints its start as `(ROW, COLUMN)`, with rows from 0; Zed's rows start at 1.
      const lines = [...result.stdout.matchAll(/capture: \d+ - run, start: \((\d+), \d+\)/g)]
        .map(match => Number(match[1]) + 1);
      arrows.push(`${name}: ${lines.length > 0 ? lines.join(", ") : "none"}`);
    }
    if (query === "indents.scm") indentLines.push(`${name}: ${indentRanges(run(["query", resolve(language.directory, query), path]).stdout)}`);
  }
}
if (scripts.length === 0) failures.push("test/smoke has no scripts");

const output = resolve(root, "test", "output");
mkdirSync(output, { recursive: true });
for (const [file, lines, what] of [
  ["runnables.txt", arrows, "the run arrows"],
  ["indents.txt", indentLines, "the indentation ranges"],
]) {
  const written = `${lines.join("\n")}\n`;
  writeFileSync(resolve(output, file), written);
  const baseline = resolve(root, "test", "expected", file);
  if (!existsSync(baseline) || readFileSync(baseline, "utf8") !== written) {
    failures.push(`${what} differ from test/expected/${file}; to accept them, copy test/output/${file} over it`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`${scripts.length} scripts parse, ${queries.length} queries run over them, and their run arrows and indentation ranges match`);
