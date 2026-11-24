-- A facet: a column of plots, one for each region, whose cells draw that region's cars and share
-- their scales.
FROM vega_datasets.cars
|> WHERE Horsepower IS NOT NULL AND Miles_per_Gallon IS NOT NULL
|> AGGREGATE mark_symbol(
    x => x(Horsepower, title => 'Horsepower'),
    y => y(Miles_per_Gallon, title => 'Miles per gallon'),
    color => Cylinders,
   ) AS chart
   GROUP BY Origin
|> AGGREGATE facet_column(chart, Origin) AS chart
