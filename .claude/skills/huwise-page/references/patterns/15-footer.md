# Pattern 15: Footer

## Job

Show the reader how fresh the data is and where it comes from, on every Page, at every width and Embed Size. It also works when the Page is opened in its own tab without the Embed Caption. It is **mandatory**: the lint reports a Page without it as `missing-footer`, and it is never dropped to save height.

## Widgets

No Widget of its own. It reads `dataset.metas.data_processed` of the main context (`ods-dataset-context`, see `widgets/context.md`), so it sits **inside** that context's element (the context exists only inside its element, `core.md` scope rule). The base stylesheet gives `ods-dataset-context` `display: contents`, so wrapping the body and the footer in one context does not disturb the flex layout.

The footer's class `hw-footer` is the marker the verifier looks for (`base-stylesheet.json`, `footerClass`). Its height is fixed (`--hw-footer-h`, 32px) and part of every height budget.

## Snippet

```html
<div class="hw-footer">
  <span class="hw-footer-updated">Letzte Aktualisierung: {{ {main_context}.dataset.metas.data_processed | date:'dd.MM.yyyy' }}</span>
  <a href="https://data.gr.ch/explore/dataset/{dataset_id}/?flg=de-ch" target="_blank" rel="noopener noreferrer">Quelle: {dataset_title}</a>
</div>
```

Placeholders:

- `{main_context}`: the context name of the main dataset, `datactx` by default (`core.md`, naming convention). Write it without the braces, e.g. `datactx.dataset.metas.data_processed`.
- `{dataset_id}`: the dataset ID of the main dataset, as in `datactx-dataset`.
- `{dataset_title}`: the dataset's German title, short enough for one line at 375px.

The footer is the last child of `.hw-page`, after `.hw-body`.

## Pitfalls

- A footer **outside** the context element renders "Letzte Aktualisierung:" with an empty date, because `datactx` does not exist there.
- The date format is the one place a numeric date is allowed (rulebook: content rules). Do not show `Dez 2026` here: it is a processing date, not a period.
- The link text must stay short: only the date span truncates, the link never does. Use "Quelle: data.gr.ch" or a short title.
- Do not give the footer its own height, margin or position in the Page's CSS: the budget assumes `--hw-footer-h`.
- Do not hide the footer in a media query. No width or Embed Size drops it.

## Source Example Page

Mittelverwendung im Bereich Landeslotterie (`page_examples/Mittelverwendung im Bereich Landeslotterie/`): the `fund-footer` block holds "Letzte Aktualisierung" from `fundctx.dataset.metas.data_processed` and a link to the dataset's explore page. Styling follows the AWT Design System (the base stylesheet), not that Page's CSS.
