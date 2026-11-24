; Each section by its heading, nested as the grammar nests sections, with the heading's marker as
; context and its text as the name.
(section
  (atx_heading
    .
    (_) @context
    (_)* @name)) @item

; Each code cell, by the language that its braces name.
(pandoc_code_block
  (attribute_specifier
    (language_specifier) @name)) @item
