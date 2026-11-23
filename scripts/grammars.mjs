// The grammars of extension.toml and their checkouts, for the scripts that read the grammars'
// queries and parsers.
//
// Each `[grammars.NAME]` table names a repository, a full revision, and an optional `path` of the
// grammar's directory in the repository. A grammar's checkout is the directory named as its
// repository, `tree-sitter-avenger-sql` or `tree-sitter-avenger-typst`, in the directory of
// `--grammars DIR`, by default the parent of this repository, and its HEAD must be the revision.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

export const root = resolve(import.meta.dirname, "..");

// The grammar tables of extension.toml, in their order.
export function grammars() {
  const manifest = readFileSync(resolve(root, "extension.toml"), "utf8");
  const tables = [...manifest.matchAll(/^\[grammars\.([a-z_]+)\]\n((?:[a-z_]+ = .*\n)+)/gm)];
  return tables.map(([, name, body]) => {
    const field = key => body.match(new RegExp(`^${key} = "([^"]*)"$`, "m"))?.[1];
    const grammar = { name, repository: field("repository"), rev: field("rev"), path: field("path") ?? "" };
    if (!grammar.repository) throw new Error(`grammar ${name} has no repository`);
    if (!/^[0-9a-f]{40}$/.test(grammar.rev ?? "")) throw new Error(`grammar ${name} must pin a full revision`);
    return grammar;
  });
}

// The directory of a grammar in its checkout, after checking that the checkout is at the
// grammar's revision.
export function checkout(grammar) {
  const argument = process.argv.indexOf("--grammars");
  const parent = argument >= 0 && process.argv[argument + 1] ? resolve(process.argv[argument + 1]) : resolve(root, "..");
  const repository = resolve(parent, basename(grammar.repository));
  if (!existsSync(resolve(repository, ".git"))) {
    throw new Error(`no checkout of ${grammar.repository} at ${repository}; pass --grammars DIR`);
  }
  const head = execFileSync("git", ["-C", repository, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (head !== grammar.rev) {
    throw new Error(`${repository} is at ${head}; extension.toml pins ${grammar.name} at ${grammar.rev}`);
  }
  return resolve(repository, grammar.path);
}

// The language directories of languages/, each with the grammar that its config.toml names.
export function languages() {
  return readdirSync(resolve(root, "languages"))
    .filter(name => existsSync(resolve(root, "languages", name, "config.toml")))
    .sort()
    .map(name => {
      const directory = resolve(root, "languages", name);
      const text = readFileSync(resolve(directory, "config.toml"), "utf8");
      const field = key => text.match(new RegExp(`^${key} = "([^"]*)"$`, "m"))?.[1];
      const suffixes = text.match(/^path_suffixes = \[(.*)\]$/m)?.[1] ?? "";
      return {
        directory,
        name: field("name"),
        grammar: field("grammar"),
        hidden: /^hidden = true$/m.test(text),
        suffixes: [...suffixes.matchAll(/"([^"]*)"/g)].map(m => m[1]),
      };
    });
}
