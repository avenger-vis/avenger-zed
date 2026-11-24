-- Layers and charts that draw different rows of one input: each car as a point, each region's
-- mean as a larger point over them, and beside them a bar of each region's count.
FROM vega_datasets.cars
|> WHERE Horsepower IS NOT NULL AND Miles_per_Gallon IS NOT NULL
|> AGGREGATE hconcat(
    layer(
        mark_symbol(
            x => x(Horsepower, title => 'Horsepower'),
            y => y(Miles_per_Gallon, title => 'Miles per gallon'),
            color => Origin,
            id => 'cars',
        ),
        mark_symbol(
            x => x(avg(Horsepower), title => 'Horsepower'),
            y => y(avg(Miles_per_Gallon), title => 'Miles per gallon'),
            color => Origin,
            size => 300,
            stroke => 'black',
            id => 'means',
        ),
    ),
    mark_bar(x => Origin, y => count(*), color => Origin, id => 'counts'),
   ) AS chart
