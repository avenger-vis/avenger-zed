import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

const executableCandidates = [
  process.env.TREE_SITTER,
  resolve(root, "node_modules", ".bin", process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter"),
  resolve(grammarRoot, "node_modules", ".bin", process.platform === "win32" ? "tree-sitter.cmd" : "tree-sitter"),
].filter(Boolean);
const treeSitter = executableCandidates.find(existsSync);
if (!treeSitter) throw new Error("tree-sitter CLI not found; install dependencies or set TREE_SITTER");

const chart = count => {
  const marks = Array.from({ length: count }, (_, index) => [
    `  mark symbol as point_${index} {`,
    `    x: ${index};`,
    `    y: coalesce($width@start, ${index});`,
    "  }",
  ].join("\n")).join("\n");
  return [
    "avenger 1;",
    "chart cartesian as query_performance {",
    "  param as width { type: float64; default: 640; }",
    marks,
    "}",
    "",
  ].join("\n");
};

const queryRoot = resolve(root, "languages", "avenger");
const queryNames = ["highlights", "brackets", "indents", "outline", "runnables"];
const run = args => {
  const started = process.hrtime.bigint();
  const result = spawnSync(treeSitter, args, {
    cwd: grammarRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
    shell: process.platform === "win32",
    stdio: ["ignore", "ignore", "pipe"],
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1_000_000;
  if (result.status !== 0) {
    throw new Error(`tree-sitter ${args.slice(0, 3).join(" ")} ... exited ${result.status}\n${result.stderr}`);
  }
  return elapsedMs;
};
const median = values => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const temporaryRoot = mkdtempSync(resolve(tmpdir(), "avenger-zed-performance-"));
const scenarios = new Map([["minimal", 1], ["representative", 100], ["large", 1000]]);
const measurements = {};
try {
  for (const [scenario, markCount] of scenarios) {
    const path = resolve(temporaryRoot, `${scenario}.avenger`);
    const source = chart(markCount);
    writeFileSync(path, source);
    run(["parse", "--quiet", path]);
    measurements[scenario] = { bytes: Buffer.byteLength(source), marks: markCount, queries_ms: {} };
    for (const query of queryNames) {
      const args = ["query", "--captures", resolve(queryRoot, `${query}.scm`), path];
      run(args);
      run(args);
      const samples = Array.from({ length: 7 }, () => run(args));
      measurements[scenario].queries_ms[query] = Number(median(samples).toFixed(3));
    }
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

console.log(JSON.stringify({
  recorded_at: new Date().toISOString(),
  platform: `${process.platform}-${process.arch}`,
  node: process.version,
  tree_sitter: "0.26.3",
  grammar_revision: revision,
  method: "median of 7 warmed tree-sitter CLI process runs; process startup included",
  scenarios: measurements,
}, null, 2));
