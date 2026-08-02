import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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
  "module_recovery.avenger",
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
for (const expected of ["comment.doc", "keyword", "function", "constant", "variable.special", "attribute", "property"]) {
  if (!highlights.includes(` - ${expected},`)) throw new Error(`highlight fixture is missing @${expected}`);
}
for (const bindingPart of ["$", "width"]) {
  const lines = highlights.split("\n").filter(line => line.includes(`text: \`${bindingPart}\``));
  if (!lines.some(line => line.includes(" - variable.special,"))) {
    throw new Error(`binding component ${bindingPart} is not highlighted as @variable.special`);
  }
  if (bindingPart === "$" && lines.some(line => line.includes(" - punctuation.special,"))) {
    throw new Error("binding sigil still uses a separate punctuation highlight");
  }
}
for (const mode of ["direct", "encoded"]) {
  const lines = highlights.split("\n").filter(line => line.includes(`text: \`${mode}\``));
  if (!lines.some(line => line.includes(" - constant,"))) {
    throw new Error(`channel mode ${mode} is not highlighted as @constant`);
  }
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

const runnableOutput = fixture => run([
  "query", "--captures", resolve(queryRoot, "runnables.scm"),
  resolve(fixtureRoot, fixture),
]);
const multiChartRunnables = runnableOutput("multi_chart.avenger");
for (const chart of ["overview", "detail"]) {
  if (!multiChartRunnables.includes(` - avenger_chart,`) || !multiChartRunnables.includes(`text: \`${chart}\``)) {
    throw new Error(`multi-chart runnable lost exact selector ${chart}\n${multiChartRunnables}`);
  }
}
if ((multiChartRunnables.match(/ - run,/g) ?? []).length !== 2) {
  throw new Error(`multi-chart module must expose exactly two arrows\n${multiChartRunnables}`);
}

const anonymousRunnables = runnableOutput("unbound_chart.avenger");
if ((anonymousRunnables.match(/ - run,/g) ?? []).length !== 1) {
  throw new Error(`anonymous chart must expose one arrow\n${anonymousRunnables}`);
}
if (anonymousRunnables.includes(" - avenger_chart,")) {
  throw new Error(`anonymous chart matched the named task\n${anonymousRunnables}`);
}

for (const fixture of ["data.avenger", "definitions.avenger"]) {
  const output = runnableOutput(fixture);
  if (output.includes(" - run,")) {
    throw new Error(`${fixture} must not expose a chart runnable\n${output}`);
  }
}

const recoveredRunnables = runnableOutput("module_recovery.avenger");
if ((recoveredRunnables.match(/ - run,/g) ?? []).length !== 2) {
  throw new Error(`malformed module header swallowed a later chart\n${recoveredRunnables}`);
}

const outline = run(["query", "--captures", resolve(queryRoot, "outline.scm"), ...fixtures]);
const itemCount = (outline.match(/ - item,/g) ?? []).length;
const nameCount = (outline.match(/ - name,/g) ?? []).length;
if (itemCount !== nameCount) throw new Error(`outline has ${itemCount} items but ${nameCount} names`);

const mutationRoot = mkdtempSync(resolve(tmpdir(), "avenger-zed-recovery-"));
const recoveryMutations = new Map([
  ["missing-root-close", "avenger 1;\nchart cartesian as recovery {\n  mark symbol as after_error {}\n"],
  ["missing-semicolon", "avenger 1;\nchart cartesian as recovery {\n  broken: 1\n  mark symbol as after_error {}\n}\n"],
  ["missing-paren", "avenger 1;\nchart cartesian as recovery {\n  broken: coalesce(1, 2;\n  mark symbol as after_error {}\n}\n"],
  ["missing-bracket", "avenger 1;\nchart cartesian as recovery {\n  broken: [1, 2;\n  mark symbol as after_error {}\n}\n"],
  ["unterminated-string", "avenger 1;\nchart cartesian as recovery {\n  broken: 'unterminated;\n  mark symbol as after_error {}\n}\n"],
  ["truncated-binding", "avenger 1;\nchart cartesian as recovery {\n  broken: $component.;\n  mark symbol as after_error {}\n}\n"],
  ["truncated-arrow-type", "avenger 1;\nchart cartesian as recovery {\n  param store as rows { field struct(field(int64, 'x') broken; }\n  mark symbol as after_error {}\n}\n"],
  ["partial-param-header", "avenger 1;\nchart cartesian as recovery {\n  param CAST(1 AS DOUBLE) as;\n  mark symbol as after_error {}\n}\n"],
  ["partial-mark-group-header", "avenger 1;\nchart cartesian as recovery {\n  mark group as\n  mark symbol as after_error {}\n}\n"],
  ["partial-field-header", "avenger 1;\nchart cartesian as recovery {\n  param store as rows { field int64; }\n  mark symbol as after_error {}\n}\n"],
  ["partial-output-alias", "avenger 1;\nchart cartesian as recovery {\n  output coalesce(1, 2) as;\n  mark symbol as after_error {}\n}\n"],
  ["partial-slot-header", "avenger 1;\nchart cartesian as recovery {\n  slot channel;\n  mark symbol as after_error {}\n}\n"],
  ["truncated-sql", "avenger 1;\nchart cartesian as recovery {\n  sql: FROM vega.movies SELECT (rating;\n  mark symbol as after_error {}\n}\n"],
  ["partial-named-import", "avenger 1;\nimport { badge as } from './library.avenger';\nchart cartesian as after_error {}\n"],
  ["partial-namespace-import", "avenger 1;\nimport * as from './library.avenger';\nchart cartesian as after_error {}\n"],
  ["partial-export", "avenger 1;\nexport chart cartesian as after_error {\n"],
]);
const declarationHeaderRecoveries = new Set([
  "partial-param-header",
  "partial-mark-group-header",
  "partial-field-header",
  "partial-output-alias",
  "partial-slot-header",
  "partial-named-import",
  "partial-namespace-import",
  "partial-export",
]);
try {
  for (const [name, source] of recoveryMutations) {
    const path = resolve(mutationRoot, `${name}.avenger`);
    writeFileSync(path, source);
    run(["parse", "--no-ranges", path], 1);
    for (const query of ["highlights", "brackets", "indents", "outline", "runnables"]) {
      const captures = run(["query", "--captures", resolve(queryRoot, `${query}.scm`), path]);
      if (declarationHeaderRecoveries.has(name) && query === "outline" && !captures.includes("after_error")) {
        throw new Error(`${name}: outline did not recover to the declaration after the error`);
      }
      if (declarationHeaderRecoveries.has(name) && query === "runnables" && !captures.includes(" - run,")) {
        throw new Error(`${name}: runnable did not survive declaration recovery`);
      }
    }
  }
} finally {
  rmSync(mutationRoot, { recursive: true, force: true });
}

const compilerFixtureRoot = resolve(grammarRoot, "test", "fixtures");
const compilerManifest = JSON.parse(readFileSync(resolve(compilerFixtureRoot, "avenger-fixtures.json"), "utf8"));
if (compilerManifest.sources.length !== compilerManifest.source_count) {
  throw new Error(
    `compiler fixture manifest declared ${compilerManifest.source_count} sources but listed ${compilerManifest.sources.length}`,
  );
}
const validClasses = new Set(["strict_valid", "canonical_valid", "example_valid", "stdlib_valid"]);
const compilerFixtures = compilerManifest.sources
  .filter(source => validClasses.has(source.classification))
  .map(source => resolve(compilerFixtureRoot, "compiler", "sources", source.path));
if (compilerFixtures.length === 0) {
  throw new Error(`compiler fixture manifest unexpectedly contained no valid sources`);
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

console.log(`query suite passed for ${fixtures.length} focused, ${recoveryMutations.size} recovery mutations, and ${compilerFixtures.length} compiler-valid fixtures at ${revision}`);
