import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = readFileSync(resolve(root, "extension.toml"), "utf8");
const revision = manifest.match(/^rev = "([0-9a-f]{40})"$/m)?.[1];
if (!revision) throw new Error("extension.toml must pin a full grammar SHA");

const rootArgument = process.argv.indexOf("--grammar-root");
const grammarRoot = resolve(
  rootArgument >= 0 && process.argv[rootArgument + 1]
    ? process.argv[rootArgument + 1]
    : process.env.AVENGER_GRAMMAR_ROOT ?? resolve(root, "..", "tree-sitter-avenger"),
);
if (!existsSync(resolve(grammarRoot, ".git"))) {
  throw new Error(`grammar checkout not found at ${grammarRoot}; pass --grammar-root PATH`);
}
const actualRevision = execFileSync("git", ["-C", grammarRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (actualRevision !== revision) {
  throw new Error(`grammar checkout is ${actualRevision}; manifest pins ${revision}`);
}

const files = ["highlights.scm", "brackets.scm", "indents.scm"];
const check = process.argv.includes("--check");
for (const name of files) {
  const sourcePath = resolve(grammarRoot, "queries", name);
  const destinationPath = resolve(root, "languages", "avenger", name);
  const expected = readFileSync(sourcePath);
  if (check) {
    const actual = readFileSync(destinationPath);
    if (!actual.equals(expected)) {
      throw new Error(`${destinationPath} differs from ${sourcePath}`);
    }
  } else {
    mkdirSync(dirname(destinationPath), { recursive: true });
    writeFileSync(destinationPath, expected);
  }
}

console.log(`${check ? "verified" : "synchronized"} ${files.length} grammar-owned queries at ${revision}`);
