; Languages inside avenger-sql's strings: JSON in a `JSON` literal, the value of a date, a time,
; or a range literal, the regular expression of a regex function, the format string of a
; function that formats or parses, and the Typst markup and format patterns of charts. The escape
; sequences of a string stay out of the injected text.

(typed_literal
  "JSON"
  (string
    (string_content) @injection.content)
  (#set! injection.language "json"))

; The value of a date, a time, or a range literal, as `2024-01-01` in `DATE '2024-01-01'`, which
; highlights.scm colors as a whole first.
(typed_literal
  [
    "DATE"
    "TIME"
    "DATETIME"
    "TIMESTAMP"
    "RANGE"
  ]
  (string
    (string_content) @injection.content)
  (#set! injection.language "avenger-datetime"))

; The regular expression of GoogleSQL's regex functions, their second argument, in RE2's syntax:
; `REGEXP_CONTAINS`, `REGEXP_EXTRACT`, `REGEXP_EXTRACT_ALL`, `REGEXP_EXTRACT_GROUPS`,
; `REGEXP_INSTR`, `REGEXP_MATCH`, `REGEXP_REPLACE`, and `REGEXP_SUBSTR`. Only a raw string, or a
; string without escape sequences, holds the regular expression as its text: in `'\\d+'`, the
; regular expression is `\d+`, and the injected text would be `d+`.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    .
    (arg)
    .
    (arg
      (literal
        (string
          (string_content) @injection.content) @_string)))
  (#match? @_function "^(?i)regexp_(contains|extract|extract_all|extract_groups|instr|match|replace|substr)$")
  (#match? @_string "^([rR]|[^\\\\]*$)")
  (#set! injection.language "regex"))

; The format of the functions that format and parse dates and times, their first argument, and
; of `FORMAT`: a format string, whose elements, such as `%Y`, and specifiers, such as `%'.2f`, are
; GoogleSQL's. The query names every such function of GoogleSQL, also those that avenger-sql's
; library doesn't have yet.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    .
    (arg
      (literal
        (string
          (string_content) @injection.content))))
  (#match? @_function "^(?i)(format|(format|parse)_(date|time|datetime|timestamp))$")
  (#set! injection.language "avenger-format"))

; The Typst markup and the format patterns of the arguments of avenger-sql's chart functions and
; constructors, as avenger-sql's `string-arguments.json` lists them. A constructor whose name has
; several meanings, as the plot's `title` and the tooltip's, matches only in the arguments that
; take it, and a title whose `syntax` is `'plain'` or `'plain_lines'` is no markup.
; generated: the strings of markup and of format patterns of avenger-sql/string-arguments.json, by scripts/sync_injections.mjs

; The first argument of labels.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    .
    (arg
      (literal
        (string
          (string_content) @injection.content))))
  (#match? @_function "^(?i)(labels)$")
  (#set! injection.language "avenger-format"))

; The argument `credits` (an array) of attribution.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    (named_arg
      name: (name_ref) @_argument
      value: (array_expr
        (literal
          (string
            (string_content) @injection.content) @_string))))
  (#match? @_function "^(?i)(attribution)$")
  (#match? @_argument "^(?i)(credits)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The argument `format` of field, labels, mark_geo_text, and 2 more.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    (named_arg
      name: (name_ref) @_argument
      value: (literal
        (string
          (string_content) @injection.content))))
  (#match? @_function "^(?i)(field|labels|mark_geo_text|mark_polar_text|mark_text)$")
  (#match? @_argument "^(?i)(format)$")
  (#set! injection.language "avenger-format"))

; The argument `labels` of axis, facet, graticule, and 2 more.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    (named_arg
      name: (name_ref) @_argument
      value: (literal
        (string
          (string_content) @injection.content))))
  (#match? @_function "^(?i)(axis|facet|graticule|legend|level)$")
  (#match? @_argument "^(?i)(labels)$")
  (#set! injection.language "avenger-format"))

; The argument `markup` of field, labels.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    (named_arg
      name: (name_ref) @_argument
      value: (literal
        (string
          (string_content) @injection.content) @_string)))
  (#match? @_function "^(?i)(field|labels)$")
  (#match? @_argument "^(?i)(markup)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The argument `separator` of attribution.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    (named_arg
      name: (name_ref) @_argument
      value: (literal
        (string
          (string_content) @injection.content) @_string)))
  (#match? @_function "^(?i)(attribution)$")
  (#match? @_argument "^(?i)(separator)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The argument `title` of axis, facet, facet_column, and 35 more.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    (named_arg
      name: (name_ref) @_argument
      value: (literal
        (string
          (string_content) @injection.content) @_string)))
  (#match? @_function "^(?i)(axis|facet|facet_column|facet_row|facet_wrap|hconcat|hconcat_agg|layer|layer_agg|legend|mark_area|mark_bar|mark_geo_image|mark_geo_line|mark_geo_path|mark_geo_rule|mark_geo_shape|mark_geo_symbol|mark_geo_text|mark_geo_trail|mark_image|mark_line|mark_path|mark_polar_area|mark_polar_bar|mark_polar_line|mark_polar_rect|mark_polar_rule|mark_polar_symbol|mark_polar_text|mark_polar_trail|mark_rect|mark_rule|mark_symbol|mark_text|mark_trail|vconcat|vconcat_agg)$")
  (#match? @_argument "^(?i)(title)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The argument `value` of labels.
(call_expr
  (path
    (name_ref) @_function)
  (arg_list
    (named_arg
      name: (name_ref) @_argument
      value: (literal
        (string
          (string_content) @injection.content))))
  (#match? @_function "^(?i)(labels)$")
  (#match? @_argument "^(?i)(value)$")
  (#set! injection.language "avenger-format"))

; The first argument of `subtitle(...)` as the `subtitle` of title, unless that call sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          .
          (arg
            (literal
              (string
                (string_content) @injection.content) @_string)))))) @_outer_args
  (#match? @_function "^(?i)(subtitle)$")
  (#match? @_outer "^(?i)(title)$")
  (#match? @_place "^(?i)(subtitle)$")
  (#not-match? @_outer_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The first argument of `subtitle(...)` as the `title` of axis, facet, facet_column, and 35 more.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          .
          (arg
            (literal
              (string
                (string_content) @injection.content) @_string))))))
  (#match? @_function "^(?i)(subtitle)$")
  (#match? @_outer "^(?i)(axis|facet|facet_column|facet_row|facet_wrap|hconcat|hconcat_agg|layer|layer_agg|legend|mark_area|mark_bar|mark_geo_image|mark_geo_line|mark_geo_path|mark_geo_rule|mark_geo_shape|mark_geo_symbol|mark_geo_text|mark_geo_trail|mark_image|mark_line|mark_path|mark_polar_area|mark_polar_bar|mark_polar_line|mark_polar_rect|mark_polar_rule|mark_polar_symbol|mark_polar_text|mark_polar_trail|mark_rect|mark_rule|mark_symbol|mark_text|mark_trail|vconcat|vconcat_agg)$")
  (#match? @_place "^(?i)(title)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The argument `text` of `subtitle(...)` as the `subtitle` of title, unless that call sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content) @_string)))))) @_outer_args
  (#match? @_function "^(?i)(subtitle)$")
  (#match? @_argument "^(?i)(text)$")
  (#match? @_outer "^(?i)(title)$")
  (#match? @_place "^(?i)(subtitle)$")
  (#not-match? @_outer_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The argument `text` of `subtitle(...)` as the `title` of axis, facet, facet_column, and 35 more.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content) @_string))))))
  (#match? @_function "^(?i)(subtitle)$")
  (#match? @_argument "^(?i)(text)$")
  (#match? @_outer "^(?i)(axis|facet|facet_column|facet_row|facet_wrap|hconcat|hconcat_agg|layer|layer_agg|legend|mark_area|mark_bar|mark_geo_image|mark_geo_line|mark_geo_path|mark_geo_rule|mark_geo_shape|mark_geo_symbol|mark_geo_text|mark_geo_trail|mark_image|mark_line|mark_path|mark_polar_area|mark_polar_bar|mark_polar_line|mark_polar_rect|mark_polar_rule|mark_polar_symbol|mark_polar_text|mark_polar_trail|mark_rect|mark_rule|mark_symbol|mark_text|mark_trail|vconcat|vconcat_agg)$")
  (#match? @_place "^(?i)(title)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The argument `format` of `title(...)` as the `title` of tooltip.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content)))))))
  (#match? @_function "^(?i)(title)$")
  (#match? @_argument "^(?i)(format)$")
  (#match? @_outer "^(?i)(tooltip)$")
  (#match? @_place "^(?i)(title)$")
  (#set! injection.language "avenger-format"))

; The argument `markup` of `title(...)` as the `title` of tooltip.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content) @_string))))))
  (#match? @_function "^(?i)(title)$")
  (#match? @_argument "^(?i)(markup)$")
  (#match? @_outer "^(?i)(tooltip)$")
  (#match? @_place "^(?i)(title)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The first argument of `title(...)` as the `axis` of radius, theta, x, y, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          .
          (arg
            (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(radius|theta|x|y)$")
  (#match? @_place "^(?i)(axis)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The first argument of `title(...)` as the `facet` of facet_column, facet_row, facet_wrap, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          .
          (arg
            (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(facet_column|facet_row|facet_wrap)$")
  (#match? @_place "^(?i)(facet)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The first argument of `title(...)` as the `legend` of angle, color, fill, and 9 more, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          .
          (arg
            (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(angle|color|fill|fill_opacity|opacity|pattern|shape|size|stroke|stroke_dasharray|stroke_opacity|stroke_width)$")
  (#match? @_place "^(?i)(legend)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The first argument of `title(...)` as the `title` of axis, facet, facet_column, and 35 more, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          .
          (arg
            (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(axis|facet|facet_column|facet_row|facet_wrap|hconcat|hconcat_agg|layer|layer_agg|legend|mark_area|mark_bar|mark_geo_image|mark_geo_line|mark_geo_path|mark_geo_rule|mark_geo_shape|mark_geo_symbol|mark_geo_text|mark_geo_trail|mark_image|mark_line|mark_path|mark_polar_area|mark_polar_bar|mark_polar_line|mark_polar_rect|mark_polar_rule|mark_polar_symbol|mark_polar_text|mark_polar_trail|mark_rect|mark_rule|mark_symbol|mark_text|mark_trail|vconcat|vconcat_agg)$")
  (#match? @_place "^(?i)(title)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The arguments `value`, `text`, `subtitle` of `title(...)` as the `axis` of radius, theta, x, y, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#match? @_argument "^(?i)(subtitle|text|value)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(radius|theta|x|y)$")
  (#match? @_place "^(?i)(axis)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The arguments `value`, `text`, `subtitle` of `title(...)` as the `facet` of facet_column, facet_row, facet_wrap, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#match? @_argument "^(?i)(subtitle|text|value)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(facet_column|facet_row|facet_wrap)$")
  (#match? @_place "^(?i)(facet)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The arguments `value`, `text`, `subtitle` of `title(...)` as the `legend` of angle, color, fill, and 9 more, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#match? @_argument "^(?i)(subtitle|text|value)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(angle|color|fill|fill_opacity|opacity|pattern|shape|size|stroke|stroke_dasharray|stroke_opacity|stroke_width)$")
  (#match? @_place "^(?i)(legend)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; The arguments `value`, `text`, `subtitle` of `title(...)` as the `title` of axis, facet, facet_column, and 35 more, unless it sets syntax => 'plain' or 'plain_lines'.
(call_expr
  (path
    (name_ref) @_outer)
  (arg_list
    (named_arg
      name: (name_ref) @_place
      value: (call_expr
        (path
          (name_ref) @_function)
        (arg_list
          (named_arg
            name: (name_ref) @_argument
            value: (literal
              (string
                (string_content) @injection.content) @_string))) @_args)))
  (#match? @_function "^(?i)(title)$")
  (#match? @_argument "^(?i)(subtitle|text|value)$")
  (#not-match? @_args "(?i)\\bsyntax\\s*=>\\s*r?('''|\"\"\"|'|\")(plain|plain_lines)('''|\"\"\"|'|\")")
  (#match? @_outer "^(?i)(axis|facet|facet_column|facet_row|facet_wrap|hconcat|hconcat_agg|layer|layer_agg|legend|mark_area|mark_bar|mark_geo_image|mark_geo_line|mark_geo_path|mark_geo_rule|mark_geo_shape|mark_geo_symbol|mark_geo_text|mark_geo_trail|mark_image|mark_line|mark_path|mark_polar_area|mark_polar_bar|mark_polar_line|mark_polar_rect|mark_polar_rule|mark_polar_symbol|mark_polar_text|mark_polar_trail|mark_rect|mark_rule|mark_symbol|mark_text|mark_trail|vconcat|vconcat_agg)$")
  (#match? @_place "^(?i)(title)$")
  (#not-match? @_string "(?s)^[^rR].*\\\\\\\\")
  (#set! injection.language "avenger-typst"))

; end generated
