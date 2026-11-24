; A code cell in the language that its braces name: `{avenger-sql}`, `{python}`, `{r}`. Zed
; resolves `avenger-sql` by a path suffix of Avenger SQL, and the others by the names of the
; languages that Zed or its extensions install. The content leaves out each line's block
; continuation, such as the `> ` of a cell in a block quote.
((pandoc_code_block
  (attribute_specifier
    (language_specifier) @injection.language)
  (code_fence_content) @injection.content)
  (#not-eq? @injection.language "ojs"))

; Observable JavaScript, whose name is no language of Zed's.
((pandoc_code_block
  (attribute_specifier
    (language_specifier) @_language)
  (code_fence_content) @injection.content)
  (#eq? @_language "ojs")
  (#set! injection.language "javascript"))

; A fenced block of a plain info string, ```python.
(pandoc_code_block
  (info_string) @injection.language
  (code_fence_content) @injection.content)

; Raw blocks, `{=html}` and `{=latex}`.
((pandoc_code_block
  (attribute_specifier
    (raw_specifier) @_raw)
  (code_fence_content) @injection.content)
  (#eq? @_raw "=html")
  (#set! injection.language "html"))

((pandoc_code_block
  (attribute_specifier
    (raw_specifier) @_raw)
  (code_fence_content) @injection.content)
  (#any-of? @_raw "=latex" "=tex")
  (#set! injection.language "latex"))

; The front matter.
((metadata
  body: (yaml) @injection.content)
  (#set! injection.language "yaml"))

; Math, as LaTeX, when an extension installs it.
(([
  (pandoc_math)
  (pandoc_display_math)
] @injection.content)
  (#set! injection.language "latex"))

; HTML in the text.
((html_element) @injection.content
  (#set! injection.language "html"))
