# Rulebook: what the CSS cannot enforce

The CI Rules come from the AWT Design System (ADR 0001). The base stylesheet (`base-stylesheet.css`) carries the colours, font, cards, layout and heights, so a Page that starts from it already looks right. This file holds the rules that depend on the data and the wording, which CSS cannot check. Read it before writing a Page, and again before the screenshot review.

## Base stylesheet and layout

- Paste `base-stylesheet.css` **unchanged** at the top of the Page's CSS. Everything is scoped under `.hw-page`, because Page CSS is global on the platform. Add the Page's own rules after it, and set the Target Height there: `.hw-page { --target-height: 800px; }`.
- The root element is `<div class="hw-page">`. Add `hw-has-title` when the Page shows a title and `hw-has-tabs` when a card carries a tab bar. Both reserve their height in the budget.
- Shapes (class on `.hw-body`): `hw-shape-sidebar` (Sidebar + main), `hw-shape-grid` (Card grid, 2 or 3 cards), `hw-shape-single`. Below 720px every shape becomes Narrow: the KPI and filter row on top, then one large area. In a Card grid only the first card shows when Narrow, so put the card that matters most first.
- Skeletons for every shape are in `skeleton/<shape>/` (Widget-free, for the Page Sketch). `skeleton/page/` is the complete skeleton Page (Sidebar + main, tabs with chart and map, latest-period Jahr filter, KPIs, footer): the model for how Patterns combine and the starting point for a built Page. Keep its contexts and structure, swap dataset, fields and labels.
- Areas: `hw-map-area` (minimum 280px), `hw-chart-area` (240px), `hw-table-area` (200px). Every `ods-map` and `ods-chart` sits **directly** inside one of them (lint: `no-fixed-height`). Heights are derived from `--target-height`; never write a height of your own for a chart or map.
- Budget limits: at most 4 KPI tiles, and at most 2 filters when Narrow. A Page that needs more drops content and says so in the plan list, or asks for a larger Target Height.
- Wide tables go inside `hw-table-scroll`, the only place a table may be wider than 375px. A fixed `width` or `min-width` above 375px anywhere else is a lint error (`fixed-width-too-wide`). `max-width` is always fine.
- The footer (Pattern 15, `references/patterns/15-footer.md`) is mandatory on every Page, at every width and Embed Size. Never drop it to save height (lint: `missing-footer`).
- Tab bars use the class `hw-tabs`. Together with `hw-table-scroll` it is the only allowed scroll container (`scroll-containers.json`).
- The base stylesheet is the only place that changes Widget CSS (the map's 400px minimum height). A Page's own rules never target `odswidget-*` classes to resize them.

## Chart colours

Which colours go where, the part the lint cannot see:

- Categories take the colours in this order: `#2D2D8A, #E69F00, #009E73, #56B4E9, #CC79A7, #0072B2, #D55E00`.
- "Übrige" and "Andere" are always `#6B6B6B`.
- More than 7 categories in a stacked chart: show the 7 largest and put the rest in a KPI (Pattern 6); the chart has no "Übrige" series. Never extend the order with other colours. Elsewhere (a map's `color-categories-other`) "Übrige" stays `#6B6B6B`.
- Red is never a category colour.
- Sequential maps run from `#E7E7F2` (low) to `#2D2D8A` (high): `ods-color-gradient-low` and `-high`.
- A single series uses `#2D2D8A`.
- Every value-to-colour map uses exactly the field's real values (the dry-run checks it).
- No gradients anywhere in the Page's own CSS.

## Status colours

- Status colours are success `#2F7D4F` on `#DDEEDF`, warning `#B47A12` on `#F4EAD6`, danger `#C8102E` on `#F7E1E4` and info `#4F8E94` on `#E2F0F1`. The base stylesheet offers them as `hw-status-success`, `hw-status-warning`, `hw-status-danger` and `hw-status-info`.
- Use them only when the data is a **real rating** (a traffic-light field, a status column, a threshold the data source defines). A larger value is not "good", and a category is not a status.
- Red and green never mark a category, and never stand for "more" and "less".

## Content rules

- German only: titles, labels, placeholders, empty states and the footer. No English fallback text, no `currentLanguage`.
- Numbers use the `de-ch` thousands separator (`{{ value | number:0 }}` with `flg=de-ch`). Write the unit once, in the label.
- Dates read like `Dez 2026` (`| moment:'MMM YYYY'`). No numeric-only dates in the Page text, except the footer's "Letzte Aktualisierung".
- Periods such as "latest year" are computed from the data, never typed.
- Factual, official tone, as the department speaks. No emoji, no exclamation marks, no marketing wording.
- Body text and tables are 12 to 13px. The optional title is a plain bold ink heading with an optional uppercase eyebrow, never a banner.
- An empty result shows an empty-state message ("Keine Daten für diese Auswahl").
