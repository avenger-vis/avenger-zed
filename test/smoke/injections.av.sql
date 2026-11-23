--| The injections beside Typst: regular expressions, format strings, and the values of date,
--| time, and range literals. The server reports `FORMAT` and the `RANGE<DATE>` literal as errors,
--| since avenger-sql has neither yet; the grammar injects into them anyway.
FROM UNNEST([STRUCT('a1' AS s, DATE '2024-05-07' AS d, 0.25 AS share)])
|> WHERE REGEXP_CONTAINS(s, r'^[a-z](\d+)$')
|> EXTEND
  REGEXP_REPLACE(s, r'(\d)', r'<\1>') AS wrapped,
  FORMAT_DATE('%Y-%m-%d (%a)', d) AS iso,
  PARSE_TIMESTAMP('%Y%m%d %H%M%S %Ez', '20240507 123000 +05:30') AS parsed,
  FORMAT("%'.2f%%", share * 100) AS percent,
  TIMESTAMP '2024-05-07 12:30:00.5 America/Los_Angeles' AS stamp,
  DATETIME '2024-05-07T12:30:00' AS civil,
  RANGE<DATE> '[2024-01-01, UNBOUNDED)' AS span,
  NUMERIC '1.25' AS exact,
  JSON '{"a": [1, 2]}' AS doc
