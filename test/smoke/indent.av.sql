-- The formatter's style, Google's layout of pipe syntax, with a unit of 4: what Zed indents as you
-- type, and the clauses and closers 3 deeper than their `|>`, which the language server corrects.
FROM penguins
|> WHERE body_mass_g IS NOT NULL
    AND flipper_length_mm > 200
|> AGGREGATE
    avg(body_mass_g) AS mu,
    count(*) AS n,
   GROUP BY species
|> AGGREGATE mark_bar(
    x => species,
    y => count(*),
   ) AS chart
   GROUP BY island
|> JOIN (
    FROM owners
    |> WHERE active
   ) AS o ON o.id = penguins.owner
|> EXTEND
    CASE
        WHEN n > 10 THEN 'many'
        ELSE 'few'
    END AS size;

CREATE VIEW recent AS (
    FROM orders
    |> WHERE day > DATE '2025-01-01'
);
