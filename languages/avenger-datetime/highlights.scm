; The highlighting of the values of GoogleSQL's date, time, and range literals, in Zed's capture
; names. avenger-sql's grammar injects this grammar into the strings of those literals, inside its
; own capture of the value, so text without a capture keeps that color.

[
  (year)
  (month)
  (day)
  (hour)
  (minute)
  (second)
  (fraction)
  (hours)
  (minutes)
] @number

[
  "-"
  ":"
  "."
  ","
] @punctuation.delimiter

[
  "["
  ")"
] @punctuation.bracket

(datetime
  separator: _ @punctuation.special)

(offset
  sign: _ @operator)

[
  (utc)
  (zone_name)
] @constant

[
  (unbounded)
  (null)
] @constant.builtin
