; Named charts expose the exact authored binder through
; $ZED_CUSTOM_avenger_chart. Zed preserves capture-name case in custom
; variable names.
(
  (chart_declaration
    "chart" @run
    kind: (qualified_name) @_avenger_kind
    name: (identifier) @avenger_chart)
  (#match? @_avenger_kind ".+")
  (#set! tag avenger-watch-named)
)

; A selector-free task is valid only for an anonymous chart declaration.
(
  (chart_declaration
    "chart" @run
    kind: (qualified_name) @_avenger_kind
    .
    body: (body))
  (#match? @_avenger_kind ".+")
  (#set! tag avenger-watch-anonymous)
)
