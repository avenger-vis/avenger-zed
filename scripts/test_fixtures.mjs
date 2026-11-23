// Parses the scripts of test/smoke/, the files of the manual checks in Zed, with the grammar of
// Avenger SQL at its pinned revision, and runs the language's queries over each. A script parses
// without errors, except `reserved.av.sql`, whose reserved words are errors on purpose, and each
// query compiles against the grammar.
//
// Usage: node scripts/test_fixtures.mjs [--grammars DIR]

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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

const ERRORS_ON_PURPOSE = new Set(["reserved.av.sql"]);
const smoke = resolve(root, "test", "smoke");
const scripts = readdirSync(smoke)
  .filter(name => /\.av\.sqlm?$/.test(name))
  .sort();
const queries = readdirSync(language.directory)
  .filter(name => name.endsWith(".scm"))
  .sort();
const failures = [];
for (const name of scripts) {
  const path = resolve(smoke, name);
  const parsed = run(["parse", "--quiet", path]);
  const expected = ERRORS_ON_PURPOSE.has(name) ? 1 : 0;
  if (parsed.status !== expected) {
    failures.push(`${name}: tree-sitter parse exited ${parsed.status}, expected ${expected}\n${parsed.stdout}${parsed.stderr}`);
  }
  for (const query of queries) {
    const result = run(["query", resolve(language.directory, query), path]);
    if (result.status !== 0) failures.push(`${query} over ${name}: exited ${result.status}\n${result.stderr}`);
  }
}
if (scripts.length === 0) failures.push("test/smoke has no scripts");
if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`${scripts.length} scripts parse, and ${queries.length} queries run over them`);
