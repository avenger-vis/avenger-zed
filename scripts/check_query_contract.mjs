import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifest = readFileSync(resolve(root, "extension.toml"), "utf8");
const revision = manifest.match(/^rev = "([0-9a-f]{40})"$/m)?.[1];
if (!revision) throw new Error("extension.toml must pin a full grammar SHA");

const argument = process.argv.indexOf("--grammar-root");
const grammarRoot = resolve(
  argument >= 0 && process.argv[argument + 1]
    ? process.argv[argument + 1]
    : process.env.AVENGER_GRAMMAR_ROOT ?? resolve(root, "..", "tree-sitter-avenger"),
);
const actualRevision = execFileSync("git", ["-C", grammarRoot, "rev-parse", "HEAD"], {
  encoding: "utf8",
}).trim();
if (actualRevision !== revision) {
  throw new Error(`grammar checkout is ${actualRevision}; manifest pins ${revision}`);
}

const nodeTypes = JSON.parse(readFileSync(resolve(grammarRoot, "src", "node-types.json"), "utf8"));
const nodeNames = new Set(nodeTypes.filter(node => node.named).map(node => node.type));
const fieldNames = new Set(nodeTypes.flatMap(node => Object.keys(node.fields ?? {})));
const queryNames = ["highlights.scm", "brackets.scm", "indents.scm", "outline.scm", "runnables.scm"];
const failures = [];

for (const queryName of queryNames) {
  const source = readFileSync(resolve(root, "languages", "avenger", queryName), "utf8");
  // String literals may contain query regex syntax such as `^(encoded|direct)$`.
  // They are token patterns or predicate operands, never named-node references.
  const structuralSource = source
    .replace(/"(?:\\.|[^"\\])*"/g, "\"\"")
    .replace(/;[^\n]*/g, "");
  const referencedNodes = [...structuralSource.matchAll(/\(\s*([A-Za-z_][A-Za-z0-9_]*)\b/g)].map(match => match[1]);
  const referencedFields = [...structuralSource.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:/g)].map(match => match[1]);
  for (const node of referencedNodes) {
    if (node !== "_" && !nodeNames.has(node)) failures.push(`${queryName}: unknown named node ${node}`);
  }
  for (const field of referencedFields) {
    if (!fieldNames.has(field)) failures.push(`${queryName}: unknown field ${field}`);
  }
}

if (failures.length > 0) throw new Error(`query/node contract drift:\n${failures.join("\n")}`);
console.log(`query node/field contract verified for ${queryNames.length} queries at ${revision}`);
