# Avenger for Zed

Zed language support for the [Avenger](https://github.com/avenger-vis/avenger)
visualization language.

Version 0.1 provides:

- uniform `.avenger` module detection, including ordinary dotted basenames;
- combined Avenger DSL and SQL syntax highlighting;
- bracket matching, quote/bracket auto-closing, comment toggling, and
  indentation;
- a source-ordered structural outline for private/exported module items and
  useful nested declarations;
- one exact chart gutter action per chart entrypoint for the native hot-reload
  workflow;
- native diagnostics, symbols, completion, hover, navigation, rename,
  formatting, semantic tokens, conservative quick fixes, definition
  refactors, and remote-import pinning.

Tree-sitter deliberately recovers through partially typed source. The strict
Avenger compiler remains the authority for validity and diagnostics.

## Language server

The extension starts `avenger lsp` over stdio. Launch selection is deterministic:

1. use an explicit `lsp.avenger-lsp.binary.path` setting;
2. in the Avenger monorepo, run the current source with `cargo run --release`;
3. in an ordinary project, use `avenger` from the worktree shell `PATH`;
4. otherwise show an actionable configuration/install error.

The command inherits the worktree shell environment. Explicit environment
entries override inherited values, and explicit arguments replace the default
argument list. Initialization options and workspace settings are forwarded
unchanged. For example:

```json
{
  "lsp": {
    "avenger-lsp": {
      "binary": {
        "path": "/absolute/path/to/avenger",
        "arguments": ["lsp"],
        "env": { "RUST_LOG": "avenger_lsp=debug" }
      },
      "initialization_options": {
        "ambientModules": ["/absolute/path/to/shared-data.avenger"]
      },
      "settings": {}
    }
  }
}
```

The extension does not download or bundle a server. In the source monorepo it
uses `cargo run --release -p avenger-lang-cli --bin avenger -- lsp`; installed
use requires an `avenger` binary on `PATH` or the explicit setting above.
Optional server bounds can be supplied as binary arguments after `lsp`, for
example `["lsp", "--max-document-mb", "4", "--max-concurrent-requests", "8"]`.
Run `avenger lsp --help` for the complete, version-matched list.

### Semantic highlighting and formatting

Avenger reports only standard LSP semantic-token kinds, so the extension does
not need language-specific token-color rules. Zed leaves semantic tokens off by
default. To overlay resolved params, references, properties, functions, and
namespaces on the Tree-sitter presentation, add this language setting and then
restart the language server:

```json
{
  "languages": {
    "Avenger": {
      "semantic_tokens": "combined",
      "formatter": "language_server"
    }
  }
}
```

`combined` is the recommended mode: Tree-sitter continues to own punctuation,
keywords, SQL syntax, and recovery presentation while the server adds semantic
identity. `full` is supported by Zed but intentionally disables the
Tree-sitter layer. **Format Document** changes only strict-valid files and
preserves their LF, CRLF, or bare-CR line-ending convention; invalid files are
left untouched while diagnostics remain visible.

Rename and quick fixes use versioned document edits. A rename is offered only
for authored symbols whose reference set is complete and collision-free. The
initial quick fixes cover close property-name corrections, missing declaration
binders, ambiguous SQL-column qualification, and unambiguous typed parameter
declarations such as `param float64 as width { value: 640; }`. **Inline
imported definition** uses the compiler's canonical
single-instance expansion. **Extract mark group as definition** creates a sibling
mark-definition file only when Zed advertises create-file edits and the target
does not exist. **Fetch and pin remote import** is lazy: selecting it fetches a
valid definition and inserts its exact SHA-256; normal language analysis keeps
HTTP disabled.

## Development watch workflow

The initial gutter action is intended for an Avenger source checkout. It runs
the current workspace CLI in release mode so editor testing always exercises
the source being developed:

```sh
cargo run --release -p avenger-lang-cli --bin avenger -- \
  watch /absolute/charts.avenger --chart overview
```

Prerequisites:

- Zed 1.11.3 or newer;
- Rust and Cargo installed through `rustup`;
- an Avenger checkout containing the `avenger-lang-cli` workspace package;
- the chart opened from that Avenger worktree.

Open a module and use the gutter run icon on the desired `chart` declaration.
Named charts expose their exact binder to the task as
`$ZED_CUSTOM_avenger_chart`; anonymous charts use the selector-free form. Zed
preserves the Tree-sitter capture's case in custom variable names. The
task:

- saves all buffers before launch;
- uses `$ZED_WORKTREE_ROOT` as the working directory;
- passes `$ZED_FILE` as one argument after Cargo's `--` separator and, for a
  named chart, passes the exact captured binder after `--chart`;
- retains compiler/watch output without stealing editor focus;
- cancels and replaces the same resolved chart task when rerun;
- permits independently resolved tasks for different charts in one module or
  different files.

A project can replace the language tasks in `.zed/tasks.json` using the
`avenger-watch-named` and `avenger-watch-anonymous` tags. This is useful for a
different Cargo workspace, wrapper script, environment, or an installed
`avenger` binary. The shipped 0.1 tasks remain source-workspace/Cargo based;
automatic CLI installation and version management are outside this milestone.

The language server also publishes editor-neutral chart code lenses carrying
the module URI and exact optional chart selector. Tree-sitter gutter
runnables remain Zed's primary launch surface and process manager; the two
surfaces share chart identity but do not launch duplicate processes.

## Local extension installation

Open Zed's extension gallery, choose **Install Dev Extension**, and select this
repository. Zed fetches and compiles the pinned grammar. A development install
may materialize a generated `grammars/` directory in this checkout; it is
ignored and must never be committed.

After changing `extension.toml`, grammar pins, or query files, use **Rebuild**
or reinstall the development extension. Open `Zed.log` with `zed: open log` if
loading fails.

## Development and checks

The extension's small Rust/Wasm runtime only selects and configures the native
language-server process. Node and pnpm are query/package test tooling. The
tested toolchain is Node 20.19.6, pnpm 11.9.0, Tree-sitter CLI 0.26.3, and the
current stable Rust `wasm32-wasip1` target.

```sh
pnpm install --frozen-lockfile
pnpm test
cargo test --locked
cargo check --locked --target wasm32-wasip1
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

- combined grammar: `aa3029d64770c77803e32a271d0c0e6749d9a346`;
- SQL grammar/base: `9ed9a6d5badfd34ec03e69c8cc5b3ec67c9d1553`;
- compiler contract represented by the grammar fixtures:
  `13dc389f499ec6ef3a0be7c2df26a905db33e3d9`.

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
- **No gutter action:** the declaration must still parse as a chart with a
  coordinate kind. Repair a malformed `chart` header first. A named chart
  uses its exact binder; an anonymous chart is valid only as the module's
  singleton chart.
- **Cargo cannot find a manifest/package:** open the chart from the Avenger
  source worktree or provide named/anonymous project task overrides.
- **Grammar/query load error:** rebuild the extension, inspect `Zed.log`, and
  verify the manifest SHA is publicly fetchable. Generated `grammars/` content
  is a local Zed cache, not source.
- **Multiline SQL indentation differs from structural blocks:** syntax
  highlighting remains correct, but v0.1 intentionally avoids broad SQL
  continuation captures that can double-indent surrounding DSL structure.
- **Language server not found:** install `avenger` on the worktree shell
  `PATH`, open the Avenger source monorepo with Cargo available, or configure
  `lsp.avenger-lsp.binary.path` explicitly.
- **No extract-definition action:** select a named `mark group`; unsupported free
  references or an existing sibling `<name>.avenger` intentionally
  suppress the refactor.
- **No pin-import action:** the import must be an unpinned `http://` or
  `https://` definition and the Zed client must support lazy code-action edit
  resolution. Network access occurs only after the action is selected.
- **Large document or resource-limit warning:** inspect the language-server
  log and, if the project is trusted, raise the relevant `avenger lsp` limit in
  `binary.arguments` rather than disabling all bounds.

## Current language-server scope

The native static server includes tolerant and semantic diagnostics,
incremental document synchronization, workspace watching, document symbols,
workspace symbols, structural and DataFusion-backed SQL completion, hover,
authored navigation and references, conservative cross-module rename,
strict-valid formatting, semantic tokens, chart code lenses, and local quick
fixes, definition inline/extract refactors, and lazy import pinning. Live
inspector enrichment and automatic CLI installation remain future work.
Anonymous charts use their coordinate kind as the Tree-sitter outline name.

The Rust/Wasm glue is deliberately limited to locating and launching
`avenger lsp` and forwarding Zed settings. Language semantics and future
inspector connections remain in the Avenger CLI/language crates rather than
being duplicated in the Zed extension.

## Compatibility and license

The extension has been loaded locally in Zed 1.11.3 on macOS arm64. Automated
query/package checks target macOS, Ubuntu, and Windows; that does not imply
native-window acceptance on platforms not tested manually.

The extension is MIT licensed. The synchronized query files are derived from
the MIT-licensed `avenger-vis/tree-sitter-avenger` repository at the exact
revision recorded above.

The reviewed, authorization-gated registry procedure is recorded in
[`PUBLISHING.md`](PUBLISHING.md).
