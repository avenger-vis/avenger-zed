# Avenger for Zed

Zed language support for the [Avenger](https://github.com/avenger-vis/avenger)
visualization language.

Version 0.1 provides:

- `.avenger` and `.data.avenger` detection;
- combined Avenger DSL and SQL syntax highlighting;
- bracket matching, quote/bracket auto-closing, comment toggling, and
  indentation;
- a structural outline for roots and useful named declarations;
- a chart-root gutter action for the native hot-reload workflow.

Tree-sitter deliberately recovers through partially typed source. The strict
Avenger compiler remains the authority for validity and diagnostics.

## Development watch workflow

The initial gutter action is intended for an Avenger source checkout. It runs
the current workspace CLI in release mode so editor testing always exercises
the source being developed:

```sh
cargo run --release -p avenger-lang-cli --bin avenger -- watch /absolute/chart.avenger
```

Prerequisites:

- Zed 1.11.3 or newer;
- Rust and Cargo installed through `rustup`;
- an Avenger checkout containing the `avenger-lang-cli` workspace package;
- the chart opened from that Avenger worktree.

Open a chart and use the gutter run icon on its `chart` declaration. The task:

- saves all buffers before launch;
- uses `$ZED_WORKTREE_ROOT` as the working directory;
- passes `$ZED_FILE` as one argument after Cargo's `--` separator, including
  when the path contains spaces;
- retains compiler/watch output without stealing editor focus;
- cancels and replaces the same resolved chart task when rerun;
- permits independently resolved tasks for different chart files.

A project can replace the language task with a task tagged `avenger-watch` in
`.zed/tasks.json`. This is useful for a different Cargo workspace, wrapper
script, environment, or an installed `avenger` binary. The shipped 0.1 task
will remain source-workspace/Cargo based; automatic CLI installation and
version management are outside this milestone.

## Local extension installation

Open Zed's extension gallery, choose **Install Dev Extension**, and select this
repository. Zed fetches and compiles the pinned grammar. A development install
may materialize a generated `grammars/` directory in this checkout; it is
ignored and must never be committed.

After changing `extension.toml`, grammar pins, or query files, use **Rebuild**
or reinstall the development extension. Open `Zed.log` with `zed: open log` if
loading fails.

## Development and checks

The extension has no Rust/Wasm runtime. Node and pnpm are test tooling only.
The tested toolchain is Node 20.19.6, pnpm 11.9.0, and Tree-sitter CLI 0.26.3.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm sync:queries -- --grammar-root ../tree-sitter-avenger --check
pnpm check:query-contract -- --grammar-root ../tree-sitter-avenger
pnpm test:queries -- --grammar-root ../tree-sitter-avenger
pnpm measure:queries -- --grammar-root ../tree-sitter-avenger
```

`pnpm test` audits the extension package, verifies byte-identical copies of the
grammar-owned highlight/bracket/indent queries, compiles all five extension
queries, audits their node/field references against `node-types.json`, compares
outline/runnable baselines, exercises recovery mutations, and runs every query
over the pinned compiler-valid corpus.

The performance probe reports warmed median CLI timings for deterministic
minimal, representative, and large charts. It includes process startup and is
used to spot scaling regressions, not as a machine-independent pass/fail
threshold. Reviewed platform baselines live under `test/metrics/`.

## Parser and query ownership

The extension registers one combined parser:

```text
tree-sitter-avenger-sql (generation-time SQL base)
                     -> tree-sitter-avenger (combined parser)
                     -> avenger-zed
```

SQL nodes are already present in the combined syntax tree. Zed does not load a
second SQL grammar and this extension does not claim ordinary `.sql` files.

Pinned compatibility inputs:

- combined grammar: `df950f49ade87700a8fb1823f15def56ba24a70a`;
- SQL grammar/base: `9ed9a6d5badfd34ec03e69c8cc5b3ec67c9d1553`;
- compiler contract represented by the grammar fixtures:
  `ebe15482494d911366e7737aacfe3c89fce24ec3`.

`tree-sitter-avenger` owns `highlights.scm`, `brackets.scm`, and
`indents.scm`; synchronized copies here must remain byte-identical.
`avenger-zed` owns `outline.scm`, `runnables.scm`, and `tasks.json` because
those describe Zed UI and process behavior.

To upgrade the grammar:

1. update and test the query contract in `tree-sitter-avenger`;
2. publish one immutable grammar commit;
3. update the full SHA in `extension.toml` and CI;
4. synchronize the three grammar-owned queries;
5. review node/capture and baseline diffs;
6. run automated checks and manual Zed/watch acceptance before changing the
   extension version.

## Troubleshooting

- **No Avenger language detection:** confirm the file ends in `.avenger` and
  rebuild/reinstall the dev extension. `.avgr` and `.sql` are intentionally not
  claimed.
- **No gutter action:** the root must still parse as a chart with a coordinate
  kind. Repair a malformed `chart` header first.
- **Cargo cannot find a manifest/package:** open the chart from the Avenger
  source worktree or provide an `avenger-watch` project task override.
- **Grammar/query load error:** rebuild the extension, inspect `Zed.log`, and
  verify the manifest SHA is publicly fetchable. Generated `grammars/` content
  is a local Zed cache, not source.
- **Multiline SQL indentation differs from structural blocks:** syntax
  highlighting remains correct, but v0.1 intentionally avoids broad SQL
  continuation captures that can double-indent surrounding DSL structure.

## Current limitations and future LSP

This milestone does not include semantic diagnostics, completion, hover,
navigation, rename, formatting, semantic tokens, inspector integration, or
automatic CLI installation. Unbound charts use their coordinate kind as the
Tree-sitter outline name; a future LSP can provide a semantic filename-based
name.

When the Avenger LSP is implemented, this extension may gain only the minimum
Rust/Wasm glue needed to locate and launch `avenger lsp`. Language semantics
and inspector connections remain in the Avenger CLI/language crates rather
than being duplicated in the Zed extension.

## Compatibility and license

The extension has been loaded locally in Zed 1.11.3 on macOS arm64. Automated
query/package checks target macOS, Ubuntu, and Windows; that does not imply
native-window acceptance on platforms not tested manually.

The extension is MIT licensed. The synchronized query files are derived from
the MIT-licensed `avenger-vis/tree-sitter-avenger` repository at the exact
revision recorded above.

The reviewed, authorization-gated registry procedure is recorded in
[`PUBLISHING.md`](PUBLISHING.md).
