; Documentation comments attach to the following outline item.
((line_comment) @annotation
  (#match? @annotation "^-- \\|"))

; Private top-level charts. Named charts use their binder; the singleton
; anonymous form uses its coordinate kind.
((source_file
  item: (chart_declaration
    "chart" @context
    kind: (qualified_name) @context.extra
    name: (identifier) @name) @item)
  (#match? @name ".+"))

((source_file
  item: (chart_declaration
    "chart" @context
    kind: (qualified_name) @name
    .
    body: (body)) @item)
  (#match? @name ".+"))

; Exported charts preserve one item while making visibility visible in its
; outline context.
((source_file
  item: (exported_module_item
    "export" @context
    declaration: (chart_declaration
      "chart" @context
      kind: (qualified_name) @context.extra
      name: (identifier) @name) @item))
  (#match? @name ".+"))

((source_file
  item: (exported_module_item
    "export" @context
    declaration: (chart_declaration
      "chart" @context
      kind: (qualified_name) @name
      .
      body: (body)) @item))
  (#match? @name ".+"))

; Private and exported definitions are always top-level module items.
((source_file
  item: (definition_declaration
    "define" @context
    kind: (definition_kind) @context.extra
    name: (identifier) @name) @item)
  (#match? @name ".+"))

((source_file
  item: (exported_module_item
    "export" @context
    declaration: (definition_declaration
      "define" @context
      kind: (definition_kind) @context.extra
      name: (identifier) @name) @item))
  (#match? @name ".+"))

; Top-level data items.
((source_file
  item: (catalog_declaration
    "catalog" @context
    kind: (qualified_name) @context.extra
    (as_clause name: (identifier) @name)) @item)
  (#match? @name ".+"))

((source_file
  item: (exported_module_item
    "export" @context
    declaration: (catalog_declaration
      "catalog" @context
      kind: (qualified_name) @context.extra
      (as_clause name: (identifier) @name)) @item))
  (#match? @name ".+"))

((source_file
  item: (schema_declaration
    "schema" @context
    kind: (qualified_name) @context.extra
    (as_clause name: (identifier) @name)) @item)
  (#match? @name ".+"))

((source_file
  item: (exported_module_item
    "export" @context
    declaration: (schema_declaration
      "schema" @context
      kind: (qualified_name) @context.extra
      (as_clause name: (identifier) @name)) @item))
  (#match? @name ".+"))

((source_file
  item: (table_declaration
    "table" @context
    kind: (qualified_name) @context.extra
    (as_clause name: (identifier) @name)) @item)
  (#match? @name ".+"))

((source_file
  item: (exported_module_item
    "export" @context
    declaration: (table_declaration
      "table" @context
      kind: (qualified_name) @context.extra
      (as_clause name: (identifier) @name)) @item))
  (#match? @name ".+"))

; Data declarations nested in a chart or another data declaration retain their
; source hierarchy beneath the enclosing item.
((body
  (catalog_declaration
    "catalog" @context
    kind: (qualified_name) @context.extra
    (as_clause name: (identifier) @name)) @item)
  (#match? @name ".+"))

((body
  (schema_declaration
    "schema" @context
    kind: (qualified_name) @context.extra
    (as_clause name: (identifier) @name)) @item)
  (#match? @name ".+"))

((body
  (table_declaration
    "table" @context
    kind: (qualified_name) @context.extra
    (as_clause name: (identifier) @name)) @item)
  (#match? @name ".+"))

; Scalar, store, and selection params share one declaration node. The authored
; physical type or state category remains visible beside the binder.
((param_declaration
  "param" @context
  type: (_) @context.extra
  name: (identifier) @name) @item
  (#match? @name ".+"))

((resource_declaration
  "resource" @context
  kind: (qualified_name) @context.extra
  (as_clause name: (identifier) @name)) @item
  (#match? @name ".+"))

; Bound chart and definition structure. Anonymous declarations intentionally
; do not match.
((mark_declaration "mark" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((transform_declaration "transform" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((tool_declaration "tool" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((widget_declaration "widget" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((view_declaration "view" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((event_declaration "on" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((cell_declaration "cell" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((variable_declaration "variable" @context role: (variable_role) @context.extra name: (identifier) @name) @item (#match? @name ".+"))
((derive_declaration "derive" @context kind: (qualified_name) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((adjust_declaration "adjust" @context kind: (_) @context.extra (as_clause name: (identifier) @name)) @item (#match? @name ".+"))
((slot_declaration "slot" @context kind: (slot_shape) @context.extra name: (identifier) @name) @item (#match? @name ".+"))

; Directly named declarations.
((output_declaration "output" @context name: (identifier) @name) @item (#match? @name ".+"))
((match_declaration "match" @context name: (identifier) @name) @item (#match? @name ".+"))
((part_declaration "part" @context name: (identifier) @name) @item (#match? @name ".+"))
((layer_declaration "layer" @context name: (identifier) @name) @item (#match? @name ".+"))
((field_declaration "field" @context name: (identifier) @name) @item (#match? @name ".+"))
((export_declaration "export" @context alias: (identifier) @name) @item (#match? @name ".+"))
