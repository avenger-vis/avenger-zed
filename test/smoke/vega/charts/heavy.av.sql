-- Several statements with rows: a temporary table, an earlier query, and the chart.
DECLARE min_weight INT64 DEFAULT 3000;

CREATE TEMP TABLE heavy AS (
  FROM vega_datasets.cars
  |> WHERE Weight_in_lbs > min_weight
);

FROM heavy
|> AGGREGATE COUNT(*) AS cars GROUP BY Origin;

FROM heavy
|> AGGREGATE mark_symbol(x => Horsepower, y => Miles_per_Gallon, color => Origin) AS chart
