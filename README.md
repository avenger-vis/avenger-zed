# Avenger for Zed

Zed support for [avenger-sql](https://github.com/jonmmease/avenger), the SQL of Avenger's charts:

- scripts (`.av.sql`) and modules (`.av.sqlm`) open as **Avenger SQL**, and ```` ```avenger-sql ````
  fences in Markdown and `{avenger-sql}` cells of Quarto documents take its highlighting;
- highlighting from the Tree-sitter grammar
  [tree-sitter-avenger-sql](https://github.com/avenger-vis/tree-sitter-avenger-sql), with
  injections into the strings that hold another language: the Typst markup of titles and labels,
  the format patterns of charts and of `FORMAT_DATE` and its kin, the regular expressions of the
  regex functions, the values of date, time, and range literals, and JSON;
- the language server, `avenger lsp`, for Avenger SQL and for Quarto documents: diagnostics,
  completion, hover, navigation, and the rest of
  [avenger-cli](https://github.com/jonmmease/avenger/tree/main/avenger-cli)'s editor features,
  and semantic tokens over the grammar's colors.

## Language server

The extension starts `avenger lsp` over stdio, chosen in this order:

1. an explicit `lsp.avenger-lsp.binary.path` setting;
2. in an avenger checkout, its `target/release/avenger`;
3. otherwise, `avenger` from the worktree shell's `PATH`;
4. otherwise, an error that says how to install or configure it.

The command inherits the worktree shell's environment. Explicit environment entries override
inherited values, and explicit arguments replace the default `["lsp"]`, so a `binary.path`
setting needs `"arguments": ["lsp"]`:

```json
{
  "lsp": {
    "avenger-lsp": {
      "binary": { "path": "/absolute/path/to/avenger", "arguments": ["lsp"] }
    }
  }
}
```

The extension doesn't download, bundle, or build the server. In an avenger checkout, build it
with `cargo build --release -p avenger-cli --bin avenger`.

## Semantic tokens and colors

Zed leaves semantic tokens off by default. With `combined`, the server's tokens refine the
grammar's colors, such as a column apart from a function, and Tree-sitter keeps the rest:

```json
{
  "languages": {
    "Avenger SQL": { "semantic_tokens": "combined" },
    "Quarto": { "semantic_tokens": "combined" }
  }
}
```

The server sends no tokens over the strings that an injection colors, so their colors stay in
`combined` mode. `languages/avenger-sql/semantic_token_rules.json` shows a string value of a
fixed set, such as `'plain_lines'` in `syntax => 'plain_lines'`, in italics.

Zed's bundled themes give Typst's emphasis, `_island_`, a color and no italic, as they do for
Markdown's. A theme override makes it italic, for the theme in use:

```json
{
  "theme_overrides": {
    "One Dark": { "syntax": { "emphasis": { "font_style": "italic" } } }
  }
}
```

## Grammars and queries

The extension registers four grammars, each pinned to a full revision in `extension.toml`:
`avenger_sql`, and from its repository's `format/` and `datetime/` directories `avenger_format`
and `avenger_datetime`, and `avenger_typst` from
[tree-sitter-avenger-typst](https://github.com/avenger-vis/tree-sitter-avenger-typst). Each has a
language: `Avenger SQL`, and the hidden `Avenger Format`, `Avenger Datetime`, and `Avenger Typst`,
which only injections reach, by their file suffixes. Zed's bundled `JSON` and `Regex` languages
take the other injections. The extension doesn't claim ordinary `.sql` files.

The grammars own their queries. `languages/*/` holds byte-identical copies of each grammar's
`queries/*.scm` at its pinned revision, which `sync_queries.mjs` writes after a grammar's pin
changes:

```sh
node scripts/sync_queries.mjs --grammars ..
```

`--grammars` names the directory of the grammars' checkouts, `tree-sitter-avenger-sql` and
`tree-sitter-avenger-typst`, by default this repository's parent. Each checkout must be at its
pinned revision.

## Local installation

In Zed, run `zed: install dev extension` and select this repository. Zed fetches and compiles the
pinned grammars into a `grammars/` directory here, which is ignored. After a change of
`extension.toml` or of a query, rebuild or reinstall the dev extension, and open the log with
`zed: open log` if loading fails. `test/smoke/SMOKE.md` lists the checks to make in Zed.

## Development and checks

The extension's Rust runtime only chooses and configures the language server's process. Node and
pnpm run the package's checks, with Node 24, pnpm 11.9.0, Tree-sitter CLI 0.26.3, and the
current stable Rust `wasm32-wasip2` target.

```sh
pnpm install --frozen-lockfile
pnpm test
cargo test --locked
cargo check --locked --target wasm32-wasip2
```

`pnpm test`, with the grammars' checkouts beside this repository, checks the package: the manifest and its pins, which CI's checkouts match, that every
language that an injection names resolves to a language of the extension or of Zed, and the
adapter. It then checks that the query copies match their grammars, and parses the scripts of
`test/smoke/` with the pinned grammar while running the language's queries over them. The
grammars' own repositories test the queries' captures.
