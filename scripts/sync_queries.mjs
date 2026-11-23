// Copies each grammar's queries into the language that uses the grammar: every `.scm` file of the
// `queries/` directory of the grammar's checkout, at the revision that extension.toml pins, into
// the language directory whose config.toml names the grammar. The extension doesn't edit them.
//
// Usage: node scripts/sync_queries.mjs [--grammars DIR] [--check]
//
// With --check, it writes nothing and fails when a copy differs from its grammar's file.

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { checkout, grammars, languages, root } from "./grammars.mjs";

const check = process.argv.includes("--check");
const byName = new Map(grammars().map(grammar => [grammar.name, grammar]));
const differ = [];
for (const language of languages()) {
  const grammar = byName.get(language.grammar);
  if (!grammar) throw new Error(`${language.name} names the grammar ${language.grammar}, which extension.toml lacks`);
  const queries = resolve(checkout(grammar), "queries");
  const files = readdirSync(queries).filter(name => name.endsWith(".scm")).sort();
  if (files.length === 0) throw new Error(`${queries} has no queries`);
  for (const name of files) {
    const source = resolve(queries, name);
    const destination = resolve(language.directory, name);
    const expected = readFileSync(source);
    if (check) {
      if (!existsSync(destination) || !readFileSync(destination).equals(expected)) {
        differ.push(`${relative(root, destination)} differs from ${grammar.name}'s ${name}`);
      }
    } else {
      writeFileSync(destination, expected);
    }
  }
}
if (differ.length > 0) {
  console.error(`${differ.join("\n")}\nrun node scripts/sync_queries.mjs`);
  process.exit(1);
}
