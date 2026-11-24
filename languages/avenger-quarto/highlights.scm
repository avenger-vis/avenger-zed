; Quarto Markdown, from the node types of q2's grammar, with q2's own highlights.scm as the
; reference of what each node is, in the capture names of Zed's themes and of Zed's Markdown.
; No capture covers the inside of a cell or the front matter's YAML, which their injected
; languages color, nor HTML and math, which are injected too.

; Headings: the marker and the text, node by node, so the marker and attributes keep theirs.
[
  (atx_h1_marker)
  (atx_h2_marker)
  (atx_h3_marker)
  (atx_h4_marker)
  (atx_h5_marker)
  (atx_h6_marker)
] @punctuation.markup

(atx_heading
  [
    (pandoc_str)
    (pandoc_space)
    (pandoc_code_span)
    (pandoc_span)
    (citation)
    (shortcode)
  ] @title.markup)

; Emphasis.
(pandoc_emph) @emphasis.markup
(pandoc_strong) @emphasis.strong.markup
(pandoc_strikeout) @strikethrough.markup

[
  (emphasis_delimiter)
  (strong_emphasis_delimiter)
  (strikeout_delimiter)
  (subscript_delimiter)
  (superscript_delimiter)
  (code_span_delimiter)
  (inline_note_delimiter)
] @punctuation.markup

; Code spans.
(pandoc_code_span
  (content) @text.literal.markup)

; Links and images: a span is a link when it has a target.
(pandoc_span
  (content) @link_text.markup
  (target))

(pandoc_image
  (content) @link_text.markup)

(target
  (url) @link_uri.markup)

(target
  (title) @string)

; Attributes, `{#fig-x .callout-note key="value"}`, on divs, spans, headings, and cells.
(attribute_id) @label
(attribute_class) @type
(key_value_key) @property
(key_value_value) @string

; Shortcodes, `{{< include file.qmd >}}`.
(shortcode_delimiter) @punctuation.special
(shortcode_name) @function
[
  (shortcode_string)
  (shortcode_naked_string)
] @string
(shortcode_number) @number

; Citations and cross-references, `@fig-weather` and `[-@smith2020]`.
(citation) @label

; Comments, HTML's `<!-- -->` and editorial `[>> ...]`.
[
  (comment)
  (edit_comment)
] @comment

; Editorial marks.
[
  (insert_delimiter)
  (delete_delimiter)
  (highlight_delimiter)
  (edit_comment_delimiter)
] @punctuation.special

; Code cells and fenced blocks: the fences and what names their language.
(fenced_code_block_delimiter) @punctuation.embedded.markup
[
  (language_specifier)
  (raw_specifier)
  (info_string)
] @label

; Lists, block quotes, and rules.
[
  (list_marker_plus)
  (list_marker_minus)
  (list_marker_star)
  (list_marker_dot)
  (list_marker_parenthesis)
  (list_marker_example)
  (task_list_marker_checked)
  (task_list_marker_unchecked)
] @punctuation.list_marker.markup

[
  (block_quote_marker)
  (pandoc_horizontal_rule)
] @punctuation.markup
