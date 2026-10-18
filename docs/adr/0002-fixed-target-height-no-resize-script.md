# Pages fit a fixed Target Height and run no resize script

The gr.ch iframe component (NGRW-538) sizes an iframe automatically only when the embedded page runs a resize script (iframe-resizer or open-iframe-resizer); for data.gr.ch the editor types one fixed height into "Höhe (px)", and that height applies on every device. We decided that Pages do not add such a script and instead are built to fit their Target Height at every width, from 375px to full Gross width. A resize script would be custom JS, which Pages do not carry (it breaks the closed Widget list and the verifier, deepens the code-editor platform risk, and the Huwise editor may strip it). An iframe that scrolls inside the Host Page traps the reader's scrolling, so scrolling inside the Page is not an acceptable fallback either.

## Consequences

- Visualizations are never stacked one below the other; several large Visualizations go into tabs. Below 720px (phones and every Klein embed) a Page is a KPI and filter row plus one large area.
- Every height is a fixed pixel value derived from one `--target-height` value in the Page CSS. `100vh`, `100%` of the iframe height and `auto-resize` are banned (the data.gr.ch chart embed shows how fill-to-height breaks when anything is added below).
- The generator must hand the editor the Target Height, which the verifier checks as a hard rule at every test width.
- If gr.ch or Huwise later offers a script-free height protocol, this decision can be revisited; until then, a Page that needs more room needs a larger Target Height, not a resize script.
