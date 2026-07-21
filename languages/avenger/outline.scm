; Root declarations.
((line_comment) @annotation
  (#match? @annotation "^-- \\|"))

((chart_declaration
  "chart" @context
  .
  kind: (identifier) @context.extra
  .
  (as_clause name: (identifier) @name)) @item
  (#match? @name ".+"))

((chart_declaration
  "chart" @context
  .
  kind: (identifier) @name
  .
  body: (body)) @item
  (#match? @name ".+"))

((definition_declaration
  "define" @context
  kind: (definition_kind) @context.extra
  name: (identifier) @name) @item
  (#match? @name ".+"))

((catalog_declaration
  "catalog" @context
  .
  kind: (identifier) @context.extra
  (as_clause name: (identifier) @name)) @item
  (#match? @name ".+"))

((schema_declaration
  "schema" @context
  .
  kind: (identifier) @context.extra
  (as_clause name: (identifier) @name)) @item
  (#match? @name ".+"))

((table_declaration
  "table" @context
  .
  kind: (identifier) @context.extra
  (as_clause name: (identifier) @name)) @item
  (#match? @name ".+"))

; Named state and resources.
((param_declaration "param" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((store_declaration "store" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((selection_declaration "selection" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((resource_declaration "resource" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))

; Bound chart structure. Anonymous declarations intentionally do not match.
((group_declaration "group" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((mark_declaration "mark" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((transform_declaration "transform" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((tool_declaration "tool" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((widget_declaration "widget" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((view_declaration "view" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((event_declaration "on" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((cell_declaration "cell" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((variable_declaration "variable" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((derive_declaration "derive" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((adjust_declaration "adjust" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((dimension_declaration "dimension" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((overlay_declaration "overlay" @context (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((slot_declaration "slot" @context kind: (slot_shape) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))

; Directly named declarations.
((channel_parameter_declaration "channel" @context name: (identifier) @name) @item (#match? @name ".+"))
((output_declaration "output" @context name: (identifier) @name) @item (#match? @name ".+"))
((match_declaration "match" @context name: (identifier) @name) @item (#match? @name ".+"))
((part_declaration "part" @context name: (identifier) @name) @item (#match? @name ".+"))
((layer_declaration "layer" @context name: (identifier) @name) @item (#match? @name ".+"))
((field_declaration "field" @context name: (identifier) @name) @item (#match? @name ".+"))
((export_declaration "export" @context alias: (identifier) @name) @item (#match? @name ".+"))
