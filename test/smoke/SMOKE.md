# Smoke checks in Zed

The checks of the extension in a running Zed, which the scripts can't make: that Zed builds and
loads the grammars, which files open as Avenger SQL, the colors of the queries and the injections,
the server's semantic tokens over them, the server in Quarto's cells, the run arrows, the
debugger, and Quarto 2 documents. Run them before a
release, with the Zed version and the platform in the release's notes.

## Setup

1. Install the Rust target that Zed builds extensions for: `rustup target add wasm32-wasip2`.
2. In Zed, run `zed: install dev extension` and pick this repository. Zed builds the extension and
   the grammars. `zed: open log` shows the build's errors. A build that fails leaves the previous
   extension loaded, and Zed refuses a grammar whose checkout in `grammars/` has another remote,
   so remove `grammars/NAME` after a grammar's repository changes.
3. Point the extension at an `avenger` binary built from avenger's main, in Zed's settings:

   ```json
   "lsp": { "avenger-lsp": { "binary": { "path": "/path/to/avenger", "arguments": ["lsp"] } } },
   "languages": { "Avenger SQL": { "semantic_tokens": "combined" } }
   ```

   A `binary.path` setting bypasses the extension: Zed starts the path itself with
   `binary.arguments`, or no arguments, so the setting needs `"arguments": ["lsp"]`. Without the
   setting, in an avenger checkout, the extension starts `target/release/avenger lsp`.

   For check 11, the debugger's binary, which the extension starts with `dap`:

   ```json
   "dap": { "avenger": { "binary": "/path/to/avenger" } }
   ```
4. For checks 5 and 12, install the `Quarto` extension from Zed's registry.
5. Open this directory, `test/smoke/`, as a project.

## Checks

1. **The grammars build and load.** `zed: install dev extension` succeeds, `scatter.av.sql` shows
   highlighting, and the log has no grammar error.
2. **Reserved words.** In `reserved.av.sql`, the `where` of `FROM where` has no color, where the
   wasm reserved-word bug of Tree-sitter 0.26.3 to 0.26.7 would read it as a table, in the type
   color, and `range` before `=>` has the parameter color.
3. **File association.** `scatter.av.sql` and `helpers.av.sqlm` open as Avenger SQL (the status
   bar's language), and `plain.sql` does not.
4. **Semantic tokens.** With `"semantic_tokens": "combined"`, the server's tokens draw over the
   Tree-sitter colors, except in the strings that an injection colors:
   - In `typst.av.sql`, the title, the subtitle, and the first two credits keep the Typst colors
     of check 7.
   - A column, such as `k`, takes the server's color.
   - In the second chart, `'plain_lines'` in `syntax => 'plain_lines'` is italic in the constant
     color, from `semantic_token_rules.json`, which shows that the extension's rules apply.
5. **Quarto.** In `report.qmd`:
   - Both `{avenger-sql}` cells have avenger highlighting: the Markdown grammar's `language`
     node leaves out the braces and the attributes, and `avenger-sql` is a suffix of the
     language.
   - Hover inside a cell answers from the server, and diagnostics show in the cell, which shows
     that the server attaches to the Quarto language beside Quarto's own server.
6. **Markdown fences.** In `notes.md`, the ```` ```avenger-sql ```` block shows avenger
   highlighting.
7. **Typst injection.** In `typst.av.sql`, with `"semantic_tokens": "off"`:
   - In the title, `Penguins` is bold and `island` emphasized, with their delimiters in the
     special punctuation color, `$...$` shows its variables, operators, and numbers, `#emph` and
     `#numfmt` are functions, and `` `raw` `` is literal text.
   - In the raw subtitle, `\#1` is an escape, `#if`, `else`, and the brackets take code colors,
     and `\` is a line break's escape.
   - The first two credits of `attribution` are Typst. The third, whose `\\*` is an escaped
     backslash in a string that isn't raw, is one string color, since the injected text would
     lose the backslash.
   - A channel's title, `'*plain text*'`, and the second chart's title and subtitle, whose
     syntax is `'plain_lines'`, are one string color.
   - Zed's bundled themes (One, Ayu, Gruvbox) give `emphasis` a color and no italic, as they do
     for Markdown's emphasis. A theme override makes it italic:

     ```json
     "theme_overrides": {
       "One Dark": { "syntax": { "emphasis": { "font_style": "italic" } } }
     }
     ```
8. **The other injections.** In `injections.av.sql`, with `"semantic_tokens": "off"`:
   - The patterns of `REGEXP_CONTAINS` and `REGEXP_REPLACE` show Zed's `Regex` colors, and the
     replacement `r'<\1>'` stays a string.
   - The formats of `FORMAT_DATE`, `PARSE_TIMESTAMP`, and `FORMAT` show their directives, such as
     `%Y`, `%Ez`, and `%'.2f`, in the special string color, and `%%` as an escape.
   - The values of the `TIMESTAMP`, `DATETIME`, and `RANGE<DATE>` literals show their digits as
     numbers, their separators as punctuation, `America/Los_Angeles` as a constant, and
     `UNBOUNDED` as a built-in constant, over the special string color of the value.
   - `NUMERIC '1.25'` shows its value as a number, and `JSON '{"a": [1, 2]}'` Zed's JSON colors.
9. **Run arrows.** With `avenger` on `PATH`, open `test/smoke/vega/` as a project:
   - In `charts/heavy.av.sql`, the `CREATE TEMP TABLE`, the earlier query, and the chart's query
     take arrows, and the `DECLARE` doesn't. In `data/vega_datasets.av.sql`, the external table and
     the `LOAD DATA` take arrows, and `CREATE SCHEMA` doesn't. `modules/weather.av.sqlm` has none.
   - A click on an arrow opens a menu of Run and Debug. Run from the chart's arrow opens the
     window in front, with the chart, and its title names the statement. Run from the earlier
     query's arrow replaces the window with its rows.
   - Run from the arrow of `CREATE VIEW wet_days` in `data/summaries.av.sql` shows the view's
     rows, with its columns' types and its row count. The arrow of `CREATE TEMP TABLE heavy` there
     shows the error of a data script's temporary table.
   - In `report.qmd`, each cell's statements take arrows, and a click runs the cell's statement
     at once, without a menu, unless the settings of check 11 name the debugger for Quarto.
   - An edit of the chart's query, saved, reloads the window, which keeps its statement.
10. **Indentation.** In a new `.av.sql` file of `test/smoke/`, with `avenger lsp` of avenger's
    `main` once its formatter writes the style of `indent.av.sql`:
    - Return after `FROM t`: column 0. After `|> AGGREGATE`: column 4. After `|> AGGREGATE a,`:
      4, and after `    b,`, 4 again.
    - After the last item, Return keeps 4, and `|>` typed there goes back to 0, the column of
      `FROM`. Inside `CREATE VIEW v AS (`, a `|>` goes back to 4, the column of the inner `FROM`.
    - Return after `|> WHERE x AND`: 4.
    - Return after `|> AGGREGATE mark_bar(`: 4. A `)` typed alone on the next line stays at 4,
      then the server moves it to 3, with the cursor after the `)`.
    - `|> WHERE f(` autocloses to `()`. Return between them: the cursor's line at 4, and the `)`
      below it at 4, then 3, from the newline's correction.
    - Return just before `) AS chart`, after the last argument: the new line at 4 with the cursor
      before the `)`, then the server moves it to 3 with the cursor still before the `)`.
    - `GROUP BY` typed after the items: the server moves the line from 4 to 3 when the space
      after `BY` is typed, with the cursor after it. Return after the `GROUP BY` line keeps 3, and
      `|>` typed there goes back to 0.
    - Return after `|> EXTEND CASE`: 4, `WHEN` lines stay there, and `END` goes back to 0.
    - `CREATE VIEW v AS (` and Return: 4; `)` stays at 4, then the server moves it to 0.
    - Each of these in a cell of `vega/report.qmd`.
    - The cursor never stays behind the indentation.
11. **Debugging.** With the debugger's binary of the setup, from avenger's `main` once it has
    `avenger dap`, open `test/smoke/vega/` as a project:
    - In `charts/origins.av.sql`, a click in the gutter of each `|>` line, 3 and 4, sets a
      breakpoint. On line 2, the arrow's row, a right-click in the gutter sets one.
    - Debug from the arrow's menu: the window opens and shows the rows that enter `JOIN`, Zed
      marks line 3, and **Variables** shows `Stage`, with the columns of `heavy_by_origin`, and
      `Script`.
    - Step Over moves to the rows that enter `AGGREGATE` and marks line 4. There, `|> LIMIT 1` in
      the debug console answers `1 rows, 3 columns`, lists the row, which the window shows, and
      prints it in a grid under the answer.
      `debugger: step back` from the command palette returns to line 3.
    - Continue stops at line 4 again, and Continue once more reaches the breakpoint of line 2, the
      `result` frame, with the chart in the window and `Result`, `Selections`, `Widgets`,
      `Scale Domains`, and `Modes` in **Variables**. A zoom in the window changes the domains of
      `Scale Domains` without a step, and the debug console names the change.
    - An edit of line 4 that is saved, as `y => cars * 2`, runs the stop again: the chart changes,
      and the console names `origins.av.sql`. Restart returns to the same stop. Stop closes the
      window.
    - A breakpoint on line 1, the comment, stays where it is drawn, and the debug console says
      that it takes no stop: no statement holds the line.
    - `debugger: start` lists the scenario `Debug origins` of `.zed/debug.json`, which stops on
      entry at line 3.
    - In `report.qmd`, with `"languages": { "Quarto": { "debuggers": ["avenger"] } }` in Zed's
      settings, the first cell's arrow offers Debug, and a breakpoint on line 10 stops there.
    - In `data/summaries.av.sql`, Debug from the arrow of `heavy_by_origin`, with a breakpoint on
      the `|> WHERE` of `heavy`, stops at the 406 cars, then Step Over reaches `table heavy`, of 174
      rows.
    - In `charts/layers.av.sql`, Debug from the arrow and Continue to the `result` frame. In
      **Variables**, `Result` > `rows` > `1` > `chart` opens into three layers that draw different
      rows: `plot 1 › cars (symbol)`, 392 rows, `plot 1 › means (symbol)` and
      `plot 2 › counts (bar)`, 3 rows each. Each layer's `columns` name their channels, as
      `x: avg(Horsepower)` and `x, color: Origin`.
    - In `charts/faceted.av.sql`, Debug from the arrow and Continue to the `result` frame. The
      chart's layers name their facet cells, `plot 1 (Origin = Europe) › layer 1 (symbol)`, 68
      rows, then Japan, 79, and USA, 245, and `Scale Domains` reads `x of plots 1–3`,
      `y of plots 1–3`, and `color of plots 1–3`, which the three cells share.
    - In `charts/thresholds.av.sql`, breakpoints on lines 6 and 12, the `|> WHERE` lines, and
      on line 9, the `SET`, which stays unverified: the statement has no rows. Debug stops at
      line 6 with `min_weight = 3000` in `Script`, Continue stops at line 12 with `4000`, and
      `debugger: step back` returns to `query 1` at line 5, with `3000` again.
12. **Quarto 2.** Open `test/smoke/vega/` as a project:
    - `report.av.qmd` opens as Avenger Quarto (the status bar), and `report.qmd` still as Quarto,
      from the Quarto extension of check 5.
    - The front matter is YAML. The `##` markers and the headings' text, the callout's `:::` and
      `{.callout-note}`, the code span, `@fig-origins`, the `[span]{.smallcaps}`, and
      `{{< pagebreak >}}` have their colors; with a LaTeX extension installed, `$p > 0$` and the
      display math are LaTeX.
    - Both `{avenger-sql}` cells have avenger's highlighting and their run arrows, which open
      `avenger view` on the statement, as in check 9; the `{python}` cell is Python, and the
      `{=html}` block HTML.
    - The outline shows `Origins`, `Weather`, and `Elsewhere`, with the cells under them.
    - In Vim mode, `vac` inside the callout selects the callout, and inside a cell selects the
      cell.
    - The indentation of a new line in a cell: note whether it is Avenger SQL's, 4, after
      `|> AGGREGATE`, which is to say whether Zed takes an injected language's indentation in a
      cell.
    - The first cell's arrow offers Debug, from Avenger Quarto's `debuggers`, as Avenger SQL's
      arrows do in check 11; note whether it does without that line, which is to say whether Zed
      reads `debuggers` from the injected language.
