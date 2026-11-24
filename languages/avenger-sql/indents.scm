; Indentation as you type, with the patterns of config.toml. A bracket's lines go one unit deeper than
; the line that opens it, and so do a CASE's lines, with its END back. Pipe operators take no range:
; a range ends at its node's last token, so a new line after an operator's last item would go back
; to the `|>`, where the next item goes. config.toml's patterns indent after an open operator and
; send a `|>` back to the start of its query.
;
; A bracket's closer takes no `@end`, so it stays at the depth of the bracket's contents, and the
; language server moves it to the style's column by deleting spaces before it. A deletion before the
; cursor moves the cursor with it, where an insertion at the cursor's own column leaves the cursor
; behind: Return before `) AS chart` puts the cursor at the line's start, before the `)`.

; Each node that holds a pair of parentheses or square brackets.
[
  (arg_list)
  (cast_expr)
  (column_list)
  (cube)
  (extract_expr)
  (from_files)
  (function_body)
  (grouping_empty)
  (grouping_sets)
  (in_list)
  (in_unnest)
  (match_recognize_clause)
  (name_list)
  (options)
  (param_list)
  (paren_expr)
  (paren_join)
  (paren_query)
  (path_list)
  (pattern_group)
  (pivot_clause)
  (pivot_values)
  (repeatable)
  (replace_list)
  (rollup)
  (row_pattern)
  (sample_clause)
  (struct_expr)
  (tuple_expr)
  (type_params)
  (unnest_source)
  (unpivot_clause)
  (window_spec)
  (array_expr)
  (subscript_expr)
] @indent

(case_expr
  "END" @end) @indent

; The start of each query, where a `|>` goes back to.
(query) @start.query
