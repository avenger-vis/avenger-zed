; Root declarations.
(chart_declaration
  "chart" @context
  kind: (identifier) @context.extra
  .
  (as_clause name: (identifier) @name)) @item

(chart_declaration
  "chart" @context
  kind: (identifier) @name
  .
  body: (body)) @item

(definition_declaration
  "define" @context
  kind: (definition_kind) @context.extra
  name: (identifier) @name) @item

(catalog_declaration
  "catalog" @context
  kind: (identifier) @context.extra
  (as_clause name: (identifier) @name)) @item

(schema_declaration
  "schema" @context
  kind: (identifier) @context.extra
  (as_clause name: (identifier) @name)) @item

(table_declaration
  "table" @context
  kind: (identifier) @context.extra
  (as_clause name: (identifier) @name)) @item

; Named state and resources.
(param_declaration "param" @context (as_clause name: (identifier) @name)) @item
(store_declaration "store" @context (as_clause name: (identifier) @name)) @item
(selection_declaration "selection" @context (as_clause name: (identifier) @name)) @item
(resource_declaration "resource" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item

; Bound chart structure. Anonymous declarations intentionally do not match.
(group_declaration "group" @context (as_clause name: (identifier) @name)) @item
(mark_declaration "mark" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item
(transform_declaration "transform" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item
(tool_declaration "tool" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item
(widget_declaration "widget" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item
(view_declaration "view" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item
(event_declaration "on" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item
(cell_declaration "cell" @context kind: (identifier) @context.extra (as_clause name: (identifier) @name)) @item
(variable_declaration "variable" @context (as_clause name: (identifier) @name)) @item
(derive_declaration "derive" @context (as_clause name: (identifier) @name)) @item
(adjust_declaration "adjust" @context (as_clause name: (identifier) @name)) @item
(dimension_declaration "dimension" @context (as_clause name: (identifier) @name)) @item
(slot_declaration "slot" @context kind: (slot_shape) @context.extra (as_clause name: (identifier) @name)) @item

; Directly named declarations.
(channel_parameter_declaration "channel" @context name: (identifier) @name) @item
(output_declaration "output" @context name: (identifier) @name) @item
(match_declaration "match" @context name: (identifier) @name) @item
(part_declaration "part" @context name: (identifier) @name) @item
(layer_declaration "layer" @context name: (identifier) @name) @item
