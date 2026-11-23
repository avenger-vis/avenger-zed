# Markdown fence

The fence below should highlight as Avenger SQL, because the language lists `avenger-sql` among
its suffixes.

```avenger-sql
FROM penguins |> AGGREGATE COUNT(*) AS n GROUP BY island
```
