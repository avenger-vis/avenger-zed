-- With the wasm reserved-word bug, `where` would be a table name, in the type color. Fixed, it is
-- a syntax error without a color.
FROM where

-- A reserved word after an item is a syntax error, as in the native CLI.
FROM t |> SELECT a where

-- `range` before `=>` is an argument's name.
FROM t |> EXTEND f(range => [1, 0]) AS r
