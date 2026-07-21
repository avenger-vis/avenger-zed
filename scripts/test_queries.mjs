import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

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

const executableCandidates = [
  process.env.TREE_SITTER,
  resolve(root, "node_modules", ".bin", process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter"),
  resolve(grammarRoot, "node_modules", ".bin", process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter"),
].filter(Boolean);
const treeSitter = executableCandidates.find(existsSync);
if (!treeSitter) throw new Error("tree-sitter CLI not found; install dependencies or set TREE_SITTER");

const run = (args, expectedStatus = 0) => {
  const result = spawnSync(treeSitter, args, {
    cwd: grammarRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    shell: process.platform === "win32",
  });
  if (result.status !== expectedStatus) {
    throw new Error(`tree-sitter ${args.join(" ")} exited ${result.status}\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
};

const runIgnoringOutput = args => {
  const result = spawnSync(treeSitter, args, {
    cwd: grammarRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    shell: process.platform === "win32",
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`tree-sitter ${args.slice(0, 3).join(" ")} ... exited ${result.status}\n${result.stderr}`);
  }
};

const fixtureRoot = resolve(root, "test", "fixtures");
const fixtures = readdirSync(fixtureRoot)
  .filter(name => name.endsWith(".avenger"))
  .sort()
  .map(name => resolve(fixtureRoot, name));
const recoveryFixtures = new Set([
  "malformed_chart_header.avenger",
  "partial_binder.avenger",
  "recovery.avenger",
]);
for (const fixture of fixtures) {
  const recovery = recoveryFixtures.has(basename(fixture));
  run(["parse", "--no-ranges", fixture], recovery ? 1 : 0);
}

const queryRoot = resolve(root, "languages", "avenger");
for (const name of ["highlights.scm", "brackets.scm", "indents.scm", "outline.scm", "runnables.scm"]) {
  run(["query", "--captures", resolve(queryRoot, name), fixtures[0]]);
}

const highlights = run(["query", "--captures", resolve(queryRoot, "highlights.scm"), resolve(fixtureRoot, "chart.avenger")]);
for (const expected of ["comment.doc", "keyword", "function", "variable.special", "attribute", "property"]) {
  if (!highlights.includes(` - ${expected},`)) throw new Error(`highlight fixture is missing @${expected}`);
}

const capturePattern = /capture:\s*\d+ - ([A-Za-z0-9_.]+), start: \((\d+), (\d+)\), end: \((\d+), (\d+)\), text: `([\s\S]*?)`(?=\n\s+pattern:|\n\/[^\n]+$|$)/gm;
const normalize = output => [...output.matchAll(capturePattern)].map(match =>
  `${match[1]} ${match[2]}:${match[3]}-${match[4]}:${match[5]} ${JSON.stringify(match[6])}`
).join("\n") + "\n";

const expectedRoot = resolve(root, "test", "expected");
const update = process.argv.includes("--update");
if (update) mkdirSync(expectedRoot, { recursive: true });
for (const query of ["outline", "runnables"]) {
  for (const fixture of fixtures) {
    const actual = normalize(run(["query", "--captures", resolve(queryRoot, `${query}.scm`), fixture]));
    const expectedPath = resolve(expectedRoot, `${query}-${basename(fixture)}.txt`);
    if (update) {
      writeFileSync(expectedPath, actual);
    } else {
      const expected = readFileSync(expectedPath, "utf8");
      if (actual !== expected) {
        throw new Error(`${query} captures changed for ${basename(fixture)}\n--- expected ---\n${expected}--- actual ---\n${actual}`);
      }
    }
  }
}

const outline = run(["query", "--captures", resolve(queryRoot, "outline.scm"), ...fixtures]);
const itemCount = (outline.match(/ - item,/g) ?? []).length;
const nameCount = (outline.match(/ - name,/g) ?? []).length;
if (itemCount !== nameCount) throw new Error(`outline has ${itemCount} items but ${nameCount} names`);

const compilerFixtureRoot = resolve(grammarRoot, "test", "fixtures");
const compilerManifest = JSON.parse(readFileSync(resolve(compilerFixtureRoot, "avenger-fixtures.json"), "utf8"));
const validClasses = new Set(["strict_valid", "canonical_valid", "example_valid", "stdlib_valid"]);
const compilerFixtures = compilerManifest.sources
  .filter(source => validClasses.has(source.classification))
  .map(source => resolve(compilerFixtureRoot, "compiler", "sources", source.path));
if (compilerFixtures.length !== 93) {
  throw new Error(`expected 93 compiler-valid fixtures, found ${compilerFixtures.length}`);
}
const batches = [];
for (let index = 0; index < compilerFixtures.length; index += 20) {
  batches.push(compilerFixtures.slice(index, index + 20));
}
for (const batch of batches) runIgnoringOutput(["parse", "--quiet", ...batch]);
for (const name of ["highlights.scm", "brackets.scm", "indents.scm", "outline.scm", "runnables.scm"]) {
  for (const batch of batches) {
    runIgnoringOutput(["query", "--captures", resolve(queryRoot, name), ...batch]);
  }
}

console.log(`query suite passed for ${fixtures.length} focused and ${compilerFixtures.length} compiler-valid fixtures at ${revision}`);
