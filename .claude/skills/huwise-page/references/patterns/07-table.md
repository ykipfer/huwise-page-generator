# Pattern 7: Table

## Job

Show records as rows: a ranking, a list of places, the figures behind a chart. Use it when the reader looks up exact values. It scrolls inside its area, so a long dataset costs no page height, and a wide one scrolls sideways inside the table-scroll wrapper, never the Page.

## Widgets

- `ods-table` with `displayed-fields` (`widgets/data.md`): a sortable table on a context. It loads 40 rows at a time and scrolls infinitely (`table.js:67,108`).
- The base stylesheet's table card `hw-card hw-card--table` (4px radius, no padding), the fixed-height area `hw-table-area`, and the scroll wrapper `hw-table-scroll`. `hw-table-scroll` is the only place a table may be wider than 375px (lint `fixed-width-too-wide`).

## Snippet

```html
<div class="hw-card hw-card--table">
  <div class="hw-table-area">
    <div class="hw-table-scroll">
      <div class="hw-table-wide">
        <ods-table context="{main_context}" displayed-fields="{field_one},{field_two},{field_three}" sort="-{sort_field}"></ods-table>
      </div>
    </div>
  </div>
</div>
```

and in the Page's CSS, after the base stylesheet (only for a wide table; leave the `hw-table-wide` div out for 4 columns or fewer):

```css
.hw-page .hw-table-wide { min-width: {table_min_width}px; height: 100%; }
```

Placeholders:

- `{main_context}`: `datactx` by default.
- `{field_one},{field_two},…`: real field names from the dataset, comma separated with no spaces, in the order the columns should appear. Name them all; never leave the attribute off (the default shows every field, system fields included).
- `{table_min_width}`: the width the columns need, about 120px per column (720 for ten columns). Without it `ods-table` squeezes every column into the Page width and truncates the headers ("Betri…") instead of scrolling. `min-width` above 375px is allowed here because the wrapper sits inside `hw-table-scroll`; the lint does not report it.
- `{sort_field}`: the initial sort (`sort` is bound by the scope but missing from the ngdoc, `table.js:33`). Put `-` in front for descending, or drop the attribute.

The table card has no title: the first column header carries the meaning. If a title is needed, use the normal card with `hw-card-title` and keep the table in `hw-table-area` below it.

## Pitfalls

- The Widget is replaced by `div.odswidget.odswidget-table` with the platform default `height: 400px; overflow: hidden` (`table.js:37,40`; `less/components/table.less:1-5`). The wrapper's `overflow: auto` clips it to the area, so the table never makes the Page taller. The render stage does not count rows hidden by a scroll container.
- The column headers come from the dataset's field labels. They can be in the data's language (for example `Gemeinde Name`). If they read badly, the fix is the dataset's metadata, not the Page.
- Number columns take the platform's `de-ch` format. Do not format numbers by hand.
- The table adds its own note about the time format below the rows. It stays inside the area and scrolls with the table.
- A wide table (many `displayed-fields`) scrolls sideways inside `hw-table-scroll` only when something inside it is wider than the Page: that is the job of `hw-table-wide`. Without it the table fits the Page width and the columns get squeezed. Choose fields by what the reader needs, not to fill the width: 5 to 8 columns is a good table.
- A `width` or `min-width` above 375px anywhere **outside** `hw-table-scroll` is a lint error (`fixed-width-too-wide`). Put the wide wrapper inside it, never on the card or the area, and never target `odswidget-*` classes to widen the table.
- Column headers that are still cut off ("Gemeinde Na…") are the Widget's own header truncation at its column width; widen `{table_min_width}` or drop a column.
- Rows are not links. A table is not a navigation list: if a row must lead somewhere, use `ods-results` with `ng-repeat` and an explicit `ods-results-max` (`banned-results-repeat-without-max`).
- No red/green cell colouring for "more/less". Status colours only for real ratings (rulebook).

## Source Example Page

Finanzkennzahlen der Bündner Gemeinden (`page_examples/Finanzkennzahlen der Bündner Gemeinden/`) and Referenztarife für ausserkantonale, stationäre Spitalleistungen (`page_examples/Referenztarife für ausserkantonale, stationäre Spitalleistungen/`): an `ods-table` with `displayed-fields`. Styling follows the AWT Design System (the base stylesheet), not those Pages' CSS.

Instance Page (verified on a real dataset): `patterns/instances/07-table/`, dataset `dvs_awt_econ_20250203` (Beherbergungsstatistik der Gemeinden), ten columns in a 720px `hw-table-wide` wrapper. It passes `verify.mjs` clean at 375px (the table scrolls sideways inside `hw-table-scroll`), 720px and 1200px, with every Jahr option explored.
