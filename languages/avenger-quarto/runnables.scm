; One arrow at the top of the document, which previews the document in the browser with q2,
; re-rendering it as its files change. The cells keep their own arrows, from the runnables of the
; Avenger SQL that they inject, which open `avenger view` on a statement.
;
; Zed drops an arrow whose node ends at the end of the file, as the document node does, and as
; the last block of a document does, since a block ends at the start of the line after it. So the
; arrow is on the front matter, or else on the first node of the first block: a heading's marker,
; a fence, or a paragraph's first word. A document of front matter alone, or of one block that has
; no first node, as a rule `***`, has no arrow.
((document
  .
  (metadata) @run)
  (#set! tag quarto2-preview))

((document
  .
  (section
    .
    (_
      .
      (_) @run)))
  (#set! tag quarto2-preview))
