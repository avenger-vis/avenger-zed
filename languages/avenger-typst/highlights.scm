; The highlighting of avenger's Typst subset, in Zed's capture names. avenger-sql's grammar
; injects this grammar into the strings of markup, so text without a capture keeps the color of
; its string.
;
; Where two patterns capture one node, the later one wins, in Zed and in the Tree-sitter
; highlighter, so the general patterns come first and the patterns that refine them after, such
; as a called identifier after an identifier.

; Comments

[
  (line_comment)
  (block_comment)
] @comment

; Markup

(strong) @emphasis.strong

(emph) @emphasis

(strong
  "*" @punctuation.special)

(emph
  "_" @punctuation.special)

(raw) @text.literal

[
  (escape)
  (linebreak)
] @string.escape

; Math

(equation
  "$" @punctuation.special)

(math_ident) @variable

((math_text) @variable
  (#match? @variable "^[\\p{L}]"))

((math_text) @number
  (#match? @number "^[0-9]"))

[
  (math_shorthand)
  (math_primes)
] @operator

(math_attach
  [
    "_"
    "^"
  ] @operator)

(math_frac
  "/" @operator)

(math_delimited
  [
    "("
    ")"
    "["
    "]"
    "{"
    "}"
    "⟨"
    "⟩"
    "⌈"
    "⌉"
    "⌊"
    "⌋"
    "[|"
    "|]"
  ] @punctuation.bracket)

(math_call
  [
    "("
    ")"
  ] @punctuation.bracket)

(dot) @punctuation.delimiter

; The fields of a symbol, as `r` and `long` in `arrow.r.long`.
(math_field_access
  (math_ident)
  (math_ident) @constant)

(math_call
  .
  (math_ident) @function)

; Code

"#" @punctuation.special

(ident) @variable

[
  (none)
  (auto)
] @constant.builtin

(bool) @boolean

[
  (int)
  (float)
  (numeric)
] @number

(string) @string

(binary
  op: _ @operator)

(unary
  [
    "-"
    "+"
  ] @operator)

(spread
  ".." @operator)

(args
  [
    "("
    ")"
  ] @punctuation.bracket)

(array
  [
    "("
    ")"
  ] @punctuation.bracket)

(dict
  [
    "("
    ")"
  ] @punctuation.bracket)

(parenthesized
  [
    "("
    ")"
  ] @punctuation.bracket)

[
  "{"
  "}"
] @punctuation.bracket

(content_block
  [
    "["
    "]"
  ] @punctuation.bracket)

(args
  "," @punctuation.delimiter)

(array
  "," @punctuation.delimiter)

(dict
  "," @punctuation.delimiter)

(named
  ":" @punctuation.delimiter)

(keyed
  ":" @punctuation.delimiter)

(dict
  ":" @punctuation.delimiter)

(code_block
  ";" @punctuation.delimiter)

(field_access
  "." @punctuation.delimiter)

; Refinements: the keywords among operators, as `and` and `not`, a field, a called function,
; and an argument's name.

[
  "if"
  "else"
  "not"
  "and"
  "or"
  "in"
] @keyword

(field_access
  field: (ident) @property)

(func_call
  callee: (ident) @function)

(func_call
  callee: (field_access
    field: (ident) @function))

(named
  name: (ident) @variable.parameter)
