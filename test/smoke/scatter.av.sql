--| Penguins by island, a loose chart script.
FROM UNNEST([
  STRUCT('Biscoe' AS island, 168 AS n),
  STRUCT('Dream' AS island, 124 AS n),
  STRUCT('Torgersen' AS island, 52 AS n),
])
|> WHERE n > 10 AND EXTRACT(MONTH FROM DATE '2024-01-15') = 1
|> AGGREGATE mark_bar(
     x => island,
     y => y(n, scale => 'log'),
     title => '#emph[by island] $sum_(i=1)^n x_i$ #upper("mass") 2.5'
   ) AS chart
