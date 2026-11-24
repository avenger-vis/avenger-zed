; A run arrow on each top-level statement of a script that has rows: a query, or a statement that
; makes a table. Its task opens `avenger view` on the statement at the arrow's line, which shows
; the script's value for its last query, the rows of another query, or the table that a statement
; makes. A module's statements and a function's body take none.

((script
  [
    (query)
    (create_table_stmt)
    (create_external_table_stmt)
    (create_view_stmt)
    (load_data_stmt)
  ] @run)
  (#set! tag avenger-view))
