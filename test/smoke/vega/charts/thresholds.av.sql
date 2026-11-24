-- A variable that a SET changes between two queries: the first counts the cars over 3000 lbs, and
-- the chart draws the cars over 4000 lbs.
DECLARE min_weight INT64 DEFAULT 3000;

FROM vega_datasets.cars
|> WHERE Weight_in_lbs > min_weight
|> AGGREGATE count(*) AS cars;

SET min_weight = 4000;

FROM vega_datasets.cars
|> WHERE Weight_in_lbs > min_weight
|> AGGREGATE mark_symbol(x => Horsepower, y => Miles_per_Gallon, color => Origin) AS chart
