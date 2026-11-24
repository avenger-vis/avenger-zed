// Parses the files of test/smoke/, the files of the manual checks in Zed and of its project
// `vega/`, each with the grammar of its language at its pinned revision: scripts and modules with
// Avenger SQL's, and Quarto 2 documents with the vendored grammar of Quarto Markdown. Each file
// parses without errors, except `reserved.av.sql`, whose reserved words are errors on purpose, and
// each query of its language compiles against the grammar.
//
// The run arrows of each language's `runnables.scm` are written to test/output/runnables.txt, a
// line of each file with the lines of its arrows; the ranges of Avenger SQL's `indents.scm` to
// test/output/indents.txt; and the languages that Avenger Quarto's `injections.scm` injects into
// each document to test/output/injections.txt, with the line where each injection starts. Each is
// compared with its file in test/expected/, which a change accepts by copying the output over it.
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

// The languages whose files test/smoke/ holds, each with its grammar's checkout and its queries.
const pinned = grammars();
const tested = ["Avenger SQL", "Avenger Quarto"].map(name => {
  const language = languages().find(language => language.name === name);
  const grammar = pinned.find(grammar => grammar.name === language.grammar);
  const directory = checkout(grammar);
  const queries = readdirSync(language.directory)
    .filter(file => file.endsWith(".scm"))
    .sort();
  const run = args =>
    spawnSync(treeSitter, args, {
      cwd: directory,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
      shell: process.platform === "win32",
    });
  return { ...language, queries, run };
});

// The language of a file, by its longest matching suffix, as Zed picks it.
const languageOf = file => {
  let best;
  for (const language of tested) {
    for (const suffix of language.suffixes) {
      if (file.endsWith(`.${suffix}`) && (!best || suffix.length > best.suffix.length)) best = { language, suffix };
    }
  }
  return best?.language;
};

// The files under a directory that a tested language opens, by their paths from it, in order.
const walk = directory =>
  readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return languageOf(entry.name) ? [path] : [];
  });

const ERRORS_ON_PURPOSE = new Set(["reserved.av.sql"]);
const smoke = resolve(root, "test", "smoke");
const files = walk(smoke)
  .map(path => relative(smoke, path).replaceAll("\\", "/"))
  .sort();
const failures = [];
const arrows = [];
const indentLines = [];
const injectionLines = [];

// The top-level patterns of a query, in order, as `tree-sitter query` numbers them: the text from
// each parenthesis or bracket that opens at depth 0 to the one that closes it, with what follows
// up to the next pattern, which holds its predicates.
function patterns(source) {
  const starts = [];
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === ";") {
      while (i < source.length && source[i] !== "\n") i++;
    } else if (char === '"') {
      for (i++; i < source.length && source[i] !== '"'; i++) if (source[i] === "\\") i++;
    } else if (char === "(" || char === "[") {
      if (depth === 0) starts.push(i);
      depth++;
    } else if (char === ")" || char === "]") {
      depth--;
    }
  }
  return starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length));
}

// The injections of a document: the line where each injection's content starts, from 1, and its
// language, the captured `injection.language` or the pattern's `#set! injection.language`.
function injections(stdout, query) {
  const set = patterns(query).map(text => text.match(/#set! injection\.language "([^"]+)"/)?.[1]);
  const items = [];
  for (const match of stdout.split(/\n(?=\s*pattern: )/)) {
    const pattern = Number(match.match(/pattern:\s*(\d+)/)?.[1]);
    if (Number.isNaN(pattern)) continue;
    const content = match.match(/capture: (?:\d+ - )?injection\.content, start: \((\d+), \d+\)/);
    if (!content) continue;
    const named = match.match(/capture: (?:\d+ - )?injection\.language, start: \(\d+, \d+\), end: \(\d+, \d+\), text: `([^`]*)`/)?.[1];
    items.push(`${Number(content[1]) + 1} ${named ?? set[pattern] ?? "?"}`);
  }
  return items.length > 0 ? items.join(", ") : "none";
}

// The indentation that indents.scm gives a script, from the matches that `tree-sitter query`
// prints: each range that Zed indents, from the row of its node's start to the row of its `@end`,
// or of its node's end without one, and each query's start, which a `|>` goes back to. Zed skips a
// range that starts and ends on one row, so these leave it out.
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

for (const name of files) {
  const language = languageOf(name);
  const path = resolve(smoke, name);
  const parsed = language.run(["parse", "--quiet", path]);
  const expected = ERRORS_ON_PURPOSE.has(name.split("/").pop()) ? 1 : 0;
  if (parsed.status !== expected) {
    failures.push(`${name}: tree-sitter parse exited ${parsed.status}, expected ${expected}\n${parsed.stdout}${parsed.stderr}`);
  }
  for (const query of language.queries) {
    const queryPath = resolve(language.directory, query);
    const result = language.run(["query", "--captures", queryPath, path]);
    if (result.status !== 0) {
      failures.push(`${language.name}'s ${query} over ${name}: exited ${result.status}\n${result.stderr}`);
      continue;
    }
    if (query === "runnables.scm") {
      // A capture prints its start as `(ROW, COLUMN)`, with rows from 0; Zed's rows start at 1.
      const lines = [...result.stdout.matchAll(/capture: \d+ - run, start: \((\d+), \d+\)/g)]
        .map(match => Number(match[1]) + 1);
      arrows.push(`${name}: ${lines.length > 0 ? lines.join(", ") : "none"}`);
    }
    if (query === "indents.scm") {
      indentLines.push(`${name}: ${indentRanges(language.run(["query", queryPath, path]).stdout)}`);
    }
    if (query === "injections.scm" && language.name === "Avenger Quarto") {
      const matches = language.run(["query", queryPath, path]).stdout;
      injectionLines.push(`${name}: ${injections(matches, readFileSync(queryPath, "utf8"))}`);
    }
  }
}
for (const language of tested) {
  if (!files.some(name => languageOf(name) === language)) failures.push(`test/smoke has no file of ${language.name}`);
}

const output = resolve(root, "test", "output");
mkdirSync(output, { recursive: true });
for (const [file, lines, what] of [
  ["runnables.txt", arrows, "the run arrows"],
  ["indents.txt", indentLines, "the indentation ranges"],
  ["injections.txt", injectionLines, "the injections of the Quarto documents"],
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
console.log(`${files.length} files parse, their languages' queries run over them, and their run arrows, indentation ranges, and injections match`);
