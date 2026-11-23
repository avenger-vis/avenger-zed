--| Typst in the strings of markup, through the Avenger Typst injection, and strings that only look
--| like markup: a channel's title, and a title of a plain syntax.
FROM UNNEST([STRUCT('a' AS k, 1 AS n)])
|> AGGREGATE
  mark_bar(
    x => k,
    y => y(n, title => '*plain text*'),
    title => title(
      '*Penguins* by _island_, $sum_(i=1)^n x_i$ #emph[since] #numfmt(n, ".1f") `raw`',
      subtitle => r'Palmer LTER \#1 \ #if n > 1 [many] else [one]',
    ),
    attribution => attribution(credits => ['© _OpenStreetMap_', 'Data: *BLS*', 'Escaped: \\*BLS\\*']),
  ) AS chart,
  mark_bar(x => k, y => n, title => title('*plain* $x$', syntax => 'plain_lines', subtitle => '_plain_')) AS plain
