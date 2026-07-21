# Avenger for Zed

Zed language support for the [Avenger](https://github.com/avenger-vis/avenger)
visualization language.

The initial extension provides combined Avenger/SQL syntax highlighting,
bracket matching, indentation, a structural outline, and a chart-root gutter
action for the native hot-reload workflow. The strict Avenger compiler remains
the authority for validity and diagnostics; Tree-sitter deliberately recovers
through partially typed source.

## Development prerequisites

- Zed with local development extensions enabled;
- Rust and Cargo installed through `rustup`;
- an Avenger source checkout containing the `avenger-lang-cli` workspace
  package;
- Node.js and pnpm for extension checks.

The development gutter task runs the current checkout in release mode:

```sh
cargo run --release -p avenger-lang-cli --bin avenger -- watch /absolute/chart.avenger
```

Open the chart from within the Avenger workspace so Cargo can discover its
manifest. The task saves all buffers before launch, retains compiler output,
and rerunning the same resolved chart cancels and replaces its prior watcher.
A worktree or global task tagged `avenger-watch` can override this default.

## Local installation

Open Zed's extension gallery, choose **Install Dev Extension**, and select this
repository. After changing `extension.toml`, grammar pins, or query files,
reinstall/reload the development extension. Inspect `Zed.log` with
`zed: open log` if loading fails.

## Checks

Install the pinned development dependency and run the suite against the exact
grammar checkout named by `extension.toml`:

```sh
pnpm install
pnpm sync:queries -- --grammar-root ../tree-sitter-avenger --check
pnpm test:queries -- --grammar-root ../tree-sitter-avenger
pnpm check
```

The extension registers only the combined `tree-sitter-avenger` grammar. SQL
subtrees are part of that parser; ordinary `.sql` files are not claimed.

## Current limitations

This milestone does not yet include an LSP, semantic diagnostics, completion,
hover, navigation, formatting, semantic tokens, inspector integration, or
automatic CLI installation. Unbound charts use their coordinate kind as the
Tree-sitter outline name; a future LSP can provide the semantic filename-based
name.
