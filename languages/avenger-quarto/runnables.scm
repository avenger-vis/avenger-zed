; One arrow on the document's first line, which previews the document in the browser with q2,
; re-rendering it as its files change. The document node starts at row 0, so the arrow is on
; line 1, with or without front matter. The cells keep their own arrows, from the runnables of the
; Avenger SQL that they inject, which open `avenger view` on a statement.
((document) @run
  (#set! tag quarto2-preview))
