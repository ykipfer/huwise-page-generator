# Steps 2 to 4: Page Sketch, preview and plan list

Layout decisions follow ADR 0002. The CSS and class names come from `base-stylesheet.css` and `rulebook.md`; read the rulebook first.

## Step 2: write the Page Sketch

A Page Sketch is **Widget-free markup on the real base stylesheet**. It is written into the Page folder and its markup becomes the starting Page at build time, so containers, classes and order are final.

**Folder.** `pages/<slug>/` at the repo root (the top-level Pages directory), with `index.html` and `stylesheet.css`. The slug is **German kebab-case** from the topic (`beherbergung-gemeinden`, `finanzkennzahlen-gemeinden`). Umlauts become `ae`, `oe`, `ue`. Check that `pages/<slug>/` is not already taken by another Page; for a refinement of that Page, edit in place instead.

**Start from a skeleton.** Copy `skeleton/<shape>/index.html` into `index.html`. Copy `base-stylesheet.css` **unchanged** into `stylesheet.css` and set the Target Height on the last line (`.hw-page { --target-height: <N>px; }`). The skeleton's own `stylesheet.css` already is the base stylesheet.

**Shape (ADR 0002).**

- At 720px or more (Embed Size Gross only): Sidebar + main (`hw-shape-sidebar`), Card grid of 2 or 3 cards (`hw-shape-grid`) or Single (`hw-shape-single`).
- Below 720px, and for every Klein embed: Narrow, which the base stylesheet applies on its own (KPI and filter row, then one large area; in a Card grid only the first card shows, so put the card that matters most first).
- Several large Visualizations go into **tabs** (`hw-has-tabs`, `hw-tabs` bar), never stacked. When the height budget is short, **drop content** (fewer KPI tiles, fewer filters) and flag it; never shrink a Visualization below its minimum (map 280px, chart 240px, table area 200px).
- At most 4 KPI tiles and, when Narrow, at most 2 filters. A title only when the owner asked (`hw-has-title`, `hw-title`); by default the Embed Caption carries it.

**Content.**

- Each Visualization area is a labelled placeholder inside its fixed-height wrapper: `<div class="hw-chart-area"><div class="hw-placeholder">Säulendiagramm: Ausgaben nach Kategorie, gestapelt nach Jahr</div></div>` (`hw-map-area`, `hw-table-area` likewise). The label names the chart type, the measure, the breakdown. No mock charts, no fake bars, no drawn maps.
- KPI tiles (`hw-kpi`) and filters (`hw-filter`) carry the **real German labels** from intake. A filter's control shows a real facet value (the default the Page will have, or "Alle Gemeinden"); a KPI value is a placeholder such as "–" or a number from intake only if it was fetched anyway. No API calls are made while sketching.
- The footer (`hw-footer`, Pattern 15) is **always present**, with the real "Letzte Aktualisierung" date from the metadata and a link to the dataset. With a Companion Dataset it names both datasets.
- German only, factual tone, no emoji, no exclamation marks (rulebook, content rules).

A sketch is a real Page folder, so lint applies: `node verify.mjs pages/<slug> --target-height <N> --embed-size <size> --no-dry-run --skip-render` must pass before the preview.

## Step 3: preview

```
node verifier/preview.mjs pages/<slug> --target-height <N> --embed-size <klein|gross>
```

It writes `pages/<slug>/preview.html` (gitignored) with the sketch in iframes side by side at the verifier widths (Gross: 375, 720, 1200; Klein: 375, 720), each exactly at the Target Height, and **opens it in the owner's browser** (`--no-open` only in tests). If the sketch overflows a frame at any width, fix the sketch (drop content or pick another shape) before showing it.

## Step 4: the plan list in chat

Post the plan list right after opening the preview. One row per Visualization area:

| Area | Pattern | Fields and aggregation | Filter defaults |
|---|---|---|---|

- **Pattern**: the Pattern behind the area, by number and name (see the list below). Patterns whose file does not exist yet are named as in the list and, if the job has no Pattern, flagged.
- **Fields and aggregation**: exact field names and the aggregation (`sum(logiernaechte)` by `gemeinde_name`), with the ODSQL `where`/`group by` in words, so the owner sees what each number is.
- **Filter defaults**: per filter, the default and how it is derived ("neuester Monat, aus den Daten berechnet", Pattern 3).

Then, below the table: proposed **slug**, **Target Height**, **Embed Size** (and whether a title is shown).

**Flags** (list only those that apply; each with one sentence):

1. **missing Widget or Pattern**: the request needs something outside the closed Widget list or the 15 Patterns (a pie chart, a date-range filter, pagination, `refine-on-click`). It goes through the deliberate add step before the build.
2. **second dataset needed**: a map or a Companion Dataset. Name the Boundary Dataset catalogue entry chosen (for a map at Gemeinde level: Gemeinde, `dvs_awt_regi_202502110`, joined `bfs_nummer` to the data's key, cast with `''+`) or the Companion Dataset and the shared dimension. The owner approves the join with the sketch.
3. **content dropped to fit the Target Height**: which tiles, filters or Visualizations were left out, and that a larger Target Height would bring them back.
4. **historical-state map request**: the prompt wants a map for past periods. Maps show only periods matching the catalogue snapshot (municipality mergers), so the history goes into a chart or table next to a current-state map.
5. **values combined across datasets** (for example Logiernächte geteilt durch Einwohner): never combined, shown side by side instead.

In benchmark mode, flags are recorded and not acted on.

### The 15 Patterns (names for the plan list)

1 Dropdown filter from facet values; 2 Dropdown filter from distinct values (`ods-adv-analysis group-by`, with `limit`); 3 Filter to the latest period (A: facet sorted `-num`; B: `max(…)` plus guarded default); 4 Copy a filter to another context; 5 KPI tile (`ods-aggregation`); 6 Column, bar or line chart (`series-breakdown`, `stacked`, CI colours); 7 Table (`ods-table displayed-fields`); 8 Tabs (`ods-simple-tabs`); 9 Choropleth joined by hand to a Boundary Dataset; 10 Map tooltip from a nested context; 11 Map tooltip from the layer's own record; 12 Point map with category colours; 13 Boundary outlines as a reference layer; 14 Empty-state guard; 15 Footer (mandatory). Pattern files live in `patterns/` as they are proven.

## The gate

The owner asks for changes; regenerate the sketch (edit `pages/<slug>/` in place, re-run lint and the preview, post the changed plan list) until the owner says **ok**. Nothing is built before that, and there is no way to skip the gate in a normal run. Only an explicit "ok" (or "freigegeben") counts; a question or a partial comment does not.
