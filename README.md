# Avenger for Zed

Zed support for [avenger-sql](https://github.com/jonmmease/avenger), the SQL of Avenger's charts:

- scripts (`.av.sql`) and modules (`.av.sqlm`) open as **Avenger SQL**, and ```` ```avenger-sql ````
  fences in Markdown and `{avenger-sql}` cells of Quarto documents take its highlighting;
- highlighting from the Tree-sitter grammar
  [tree-sitter-avenger-sql](https://github.com/avenger-vis/tree-sitter-avenger-sql), with
  injections into the strings that hold another language: the Typst markup of titles and labels,
  the format patterns of charts and of `FORMAT_DATE` and its kin, the regular expressions of the
  regex functions, the values of date, time, and range literals, and JSON;
- indentation as you type, in the formatter's style;
- run arrows in the gutter on each query and table, which open `avenger view` on the statement
  or debug it;
- the debugger, `avenger dap`, which stops at a query's stages, with breakpoints on its `|>` lines
  and the rows of each stop in Zed's debugger and in the viewer's window;
- the language server, `avenger lsp`, for Avenger SQL and for Quarto documents: diagnostics,
  completion, hover, navigation, and the rest of
  [avenger-cli](https://github.com/jonmmease/avenger/tree/main/avenger-cli)'s editor features,
  and, optionally, semantic tokens over the grammar's colors.

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

The grammar and its injections give every color, so highlighting needs no setting. The server's
semantic tokens are an optional refinement, from what only its analysis knows:

- what a name refers to: a column or a field, a table or a CTE, a variable or an alias, a script
  parameter, or a module, where the grammar colors a name by its place in the syntax;
- a string value of a fixed set, such as `'plain_lines'` in `syntax => 'plain_lines'`, which
  `languages/avenger-sql/semantic_token_rules.json` shows in italics;
- a string that only looks like markup to the grammar, such as a title whose syntax is a variable
  that the analysis knows is `'plain'`, which then takes the string color.

Zed leaves semantic tokens off by default. To turn them on, with Tree-sitter's colors beneath
them:

```json
{
  "languages": {
    "Avenger SQL": { "semantic_tokens": "combined" },
    "Quarto": { "semantic_tokens": "combined" }
  }
}
```

The server sends no tokens over the strings that an injection colors, so their colors stay in
`combined` mode. Without the setting, the server still gives diagnostics, completion, hover, and
its other features.

Zed's bundled themes give Typst's emphasis, `_island_`, a color and no italic, as they do for
Markdown's. A theme override makes it italic, for the theme in use:

```json
{
  "theme_overrides": {
    "One Dark": { "syntax": { "emphasis": { "font_style": "italic" } } }
  }
}
```

## Indentation

Return indents the new line as the formatter's style lays out pipe syntax, Google's layout with a unit of 4, so Avenger SQL's `tab_size` is 4: with another unit, the indentation as you type differs from what the formatter writes. A line keeps the indentation of the line before it, and goes 4 deeper after a line that leaves something open: a pipe operator's keywords with nothing after them, as `|> AGGREGATE`, a `|>` line that ends with a comma, an open bracket, or an expression that continues, as `|> WHERE x AND`. `END` goes back 4, and a `|>` goes back to the start of its query as you type it. A bracket's closer stays at the depth of its contents, and the language server moves it to its column, 3 deeper than the `|>` for a bracket that an operator's line opens, as `) AS chart`, or back to the line that opens the bracket. The server also corrects an operator's `GROUP BY`, `WINDOW`, `ON`, and `USING`, 3 deeper than the `|>`. It corrects a closer by deleting the spaces before it, so the cursor moves with the deletion, even after Return just before the closer.

## Run arrows

Each statement of a script that has rows takes a run arrow in the gutter: each query, and each statement that makes a table, also in the `{avenger-sql}` cells of a Quarto document. A click on an arrow of a script opens a menu of **Run** and **Debug**, since the arrows' task has a debug scenario (see [Debugging](#debugging)); a cell's arrow runs at once, unless the Quarto language names the debugger. **Run** opens `avenger view` on the statement at the arrow's line, a window that reloads as the project's files change:

- the last query of a chart script, or of a cell, shows the chart, live, or the table of its result;
- another query shows its rows;
- a statement of a data script that makes a table, such as `LOAD DATA` or `CREATE VIEW`, shows the table's rows.

Each file has one window: a Run from another arrow of the same file replaces it. The task saves the open buffers first, and the window reloads when files are saved, so Zed's autosave makes it follow the text as it changes:

```json
{ "autosave": { "after_delay": { "milliseconds": 500 } } }
```

The arrows' task runs `avenger` from `PATH`. A project replaces it in its `.zed/tasks.json` with a task of the tag `avenger-view`, as an avenger checkout does to run its `target/release/avenger`:

```json
[
  {
    "label": "Avenger: View $ZED_RELATIVE_FILE",
    "command": "target/release/avenger",
    "args": ["view", "$ZED_FILE:$ZED_ROW"],
    "cwd": "$ZED_WORKTREE_ROOT",
    "tags": ["avenger-view"],
    "use_new_terminal": false,
    "allow_concurrent_runs": true,
    "reveal": "no_focus",
    "save": "all"
  }
]
```

## Debugging

The extension's debug adapter, `avenger`, is `avenger dap`, which debugs a query's stages: in pipe syntax every prefix of a query is a query, so a stop at a `|>` line shows the rows that enter its operator. The extension finds the binary as it finds the language server's, with the setting `dap.avenger.binary` in place of `lsp.avenger-lsp.binary.path`, and starts it with the argument `dap` in the worktree's root, so a target's path is relative to the project:

```json
{ "dap": { "avenger": { "binary": "/absolute/path/to/avenger" } } }
```

**Breakpoints.** A click in the gutter sets a breakpoint. A run arrow takes the place of the breakpoint button on its row, so on an arrow's row a right-click in the gutter, or `editor: toggle breakpoint`, sets one. A breakpoint on a `|>` line stops at the rows that enter its operator, on a statement's first line at the statement's result, and on another line of a statement at the statement's next `|>` line. Zed draws a breakpoint on its own line even when it stops elsewhere, and shows no message, so the debug console says where a moved breakpoint stops, and why a breakpoint takes no stop, as on a blank line, a `DECLARE`, or a line of another file.

**Debug from an arrow.** **Debug** in a run arrow's menu starts a session on the arrow's statement, `$ZED_FILE:$ZED_ROW`, as **Run** opens the viewer on it, with the debugger's binary, also when a project's `.zed/tasks.json` replaces the arrows' task. The viewer's window opens and shows each stop. A data script's statements take no session yet.

**A session.** Zed marks the stop's line, and its Debug panel lists the stop's scopes under **Variables**: `Stage` at a `|>`, or `Result` at a statement's result, with the columns and their types, the row count, and the rows in chunks of 100, and `Script`, with the variables that the script declares and their values at the stop. Step Over and Step Into move to the next stop, Step Out to the statement's result, and Continue to the next breakpoint or the target's result. Step back has no button: `debugger: step back` in the command palette returns to the stop before. A stage that fails shows its errors in the window and in the debug console.

**A scenario by hand.** A project's `.zed/debug.json` takes scenarios of the adapter `avenger`, whose `target` is a chart script, a Quarto cell as `report.qmd#2` or `report.qmd#LABEL`, or the statement at a line of either as `charts/revenue.av.sql:12`, and whose `stopOnEntry` stops at the first stop:

```json
[
  {
    "label": "Debug revenue",
    "adapter": "avenger",
    "request": "launch",
    "target": "charts/revenue.av.sql",
    "stopOnEntry": true
  }
]
```

Zed's new session dialog, `debugger: start`, also takes the adapter `avenger`: its program is the target, and a number as its first argument is the line of the target's statement.

**Quarto.** A cell's breakpoints are rows of its `.qmd` document. A Quarto document's language is Quarto's, so its cells' arrows offer **Debug** only when the Quarto language names the debugger, in Zed's settings:

```json
{ "languages": { "Quarto": { "debuggers": ["avenger"] } } }
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

The extension's Rust runtime only chooses and configures the processes of the language server and the debugger, and turns the run arrows' task into a debug scenario. Node and
pnpm run the package's checks, with Node 24, pnpm 11.9.0, Tree-sitter CLI 0.26.3, and the
current stable Rust `wasm32-wasip2` target.

```sh
pnpm install --frozen-lockfile
pnpm test
cargo test --locked
cargo check --locked --target wasm32-wasip2
```

`pnpm test`, with the grammars' checkouts beside this repository, checks the package: the manifest and its pins, which CI's checkouts match, that every
language that an injection names resolves to a language of the extension or of Zed, the
language server's adapter, and the debugger: its manifest entries, its schema, and its hooks. It then checks that the query copies match their grammars, and parses the scripts of
`test/smoke/` with the pinned grammar while running the language's queries over them, and compares their run arrows and the ranges of `indents.scm` with `test/expected/runnables.txt` and `test/expected/indents.txt`, which a change accepts by copying its file of `test/output/` over it. It also tests `config.toml`'s indentation patterns against lines that they should and shouldn't match. The
grammars' own repositories test the queries' captures.
