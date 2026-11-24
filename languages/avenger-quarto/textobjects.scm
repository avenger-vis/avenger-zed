; A section, a div such as a callout, and a code cell, for Vim mode's `ac` and `ic` and syntax
; selection.
(section
  (atx_heading)
  (_)* @class.inside) @class.around

(pandoc_div
  (attribute_specifier)
  (_)* @class.inside) @class.around

(pandoc_code_block
  (code_fence_content) @class.inside) @class.around
