# Pattern 9: Choropleth joined by hand to a Boundary Dataset

## Job

Colour the shapes of a Boundary Dataset (Gemeinde, Region, …) by one value of a data dataset, with a gradient legend. The join is **by hand**: `ods-color-gradient` computes one colour per key from the data dataset, and the map layer on the Boundary Dataset reads that colour map through `color-categories` + `color-by-field`. Shapes without a data key stay in the "other" grey.

The native join (`join-context` / `local-key` / `remote-key`) is **banned** (`banned-native-join`): it is a server-side v1 analyze call that cannot carry the boundary context's filters, and it fails silently when the key types differ.

Instance Page (proven, passes the verifier): `patterns/instances/09-choropleth/` on `dvs_awt_soci_20260112` (Zweitwohnungsanteil, key `bfs_nummer`, text) with the Gemeinde Boundary Dataset `dvs_awt_regi_202502110` (key `bfs_nummer`, text).

## Widgets

`ods-dataset-context` (`datactx` + `geoctx`), `ods-color-gradient`, `ods-map`, `ods-map-layer`, `ods-legend` (all in `widgets/map.md`), and `ods-adv-analysis` for the latest period (`widgets/data.md`, Pattern 3).

- Pick the Boundary Dataset and its key field from `boundary-catalogue.md`. The layer's `color-by-field` is the catalogue's key field, the gradient's `-x` is the data's key field.
- `ods-color-gradient-low="#E7E7F2"`, `-high="#2D2D8A"` (rulebook: sequential colours). Choose `-pow-exponent` per dataset: `1` for an evenly spread value, `0.3` to `0.5` for a long right tail (a few very large values).
- `color-categories-other="#D9D9D6"` is the colour of shapes without data. Give `ods-legend` the same colour in `no-value-color`.
- The gradient creates no scope (`core.md`, scope rule): the legend, the layer and any KPI that reads `gradient.range.min` / `.max` sit **inside** its element.

## Snippet

```html
<ods-dataset-context context="datactx, geoctx"
    datactx-dataset="{dataset_id}"
    datactx-parameters="{'refine.{period_field}': ''+(latest[0].{period_field} | moment:'YYYY')}"
    geoctx-dataset="{boundary_dataset_id}">
  <div class="hw-gradient" ods-color-gradient="gradient"
       ods-color-gradient-context="datactx"
       ods-color-gradient-x="{data_key_field}"
       ods-color-gradient-serie="AVG({value_field})"
       ods-color-gradient-low="#E7E7F2"
       ods-color-gradient-high="#2D2D8A"
       ods-color-gradient-pow-exponent="1">
    <div class="hw-card">
      <p class="hw-card-title">{card_title}</p>
      <div class="hw-map-area">
        <ods-map location="8,46.75,9.6" scroll-wheel-zoom="false" toolbar-geolocation="false" toolbar-drawing="false" display-legend="false">
          <ods-map-layer context="geoctx" display="categories"
              color-categories="gradient['colors']" color-by-field="{boundary_key_field}"
              color-categories-other="#D9D9D6"
              border-color="#FFFFFF" shape-opacity="1" tooltip-disabled="true"></ods-map-layer>
        </ods-map>
        <div class="hw-map-legend">
          <ods-legend color-gradient="gradient" title="{legend_title}" no-value-color="#D9D9D6" decimal-precision="0"></ods-legend>
        </div>
      </div>
    </div>
  </div>
</ods-dataset-context>
```

CSS (after the base stylesheet; the instance's `stylesheet.css` has it): `.hw-gradient { display: contents; }` so the gradient's wrapper is not a layout box, and `.hw-map-legend` absolutely positioned in the map area's corner (the area has `position: relative`), scaled down with `transform: scale(0.7)`.

Placeholders: `{dataset_id}` the data dataset, `{period_field}` its period field when it has several periods (omit `datactx-parameters` when it has one), `{data_key_field}` the key field of the data, `{value_field}` the value, `{boundary_dataset_id}` and `{boundary_key_field}` from the catalogue, `{card_title}` and `{legend_title}` German, with the unit once. The period is wrapped in an `ng-if="latest.length"` context as in Pattern 3; the instance Page shows the full nesting.

## Pitfalls

- **Key types.** Cast every key and refine value with `''+` (`core.md`, expression idioms). `gemeindenummer` (int) never equals `bfs_nummer` (text) otherwise. The gradient's colour map is keyed by the values as the API returns them, so the data key must hold the same strings as the catalogue's key field.
- **Mergers.** The shapes are the snapshot's municipalities (`boundary-catalogue.md`). A data period whose keys do not match the snapshot leaves holes or has keys without a shape. Show only periods whose keys match the snapshot, normally by defaulting to the latest period (Pattern 3). The dry-run reports unmatched keys as `dry-run-key-coverage`.
- **Latest period gives a warning.** The default filter is computed at runtime, and a literal year is banned (`banned-hard-coded-year`), so the dry-run checks key coverage over every period and reports `dry-run-key-coverage-filter-ignored` (a warning, never a failure). The instance Page passes with exactly this warning.
- **Date field in the period.** `ods-adv-analysis` returns a date field as a timestamp (`2026-01-01T00:00:00+00:00`), which the v1 `refine.` rejects with an API 400. Format it: `latest[0].jahr | moment:'YYYY'`.
- **Colour order.** `color-categories` wins over `color-gradient` and `color-numeric-ranges` (`widgets/map.md`), and `color` wins over all of them: never set `color` on a choropleth layer.
- **Shapes without data.** They need `color-categories-other`; without it they take the default palette. They render grey without an error (the render stage does not flag them).
- **Layout.** The single shape reserves a KPI and a filter row even when it holds none. Use the Sidebar shape, or put a real KPI in the row, as the instance does with the lowest and highest value (`gradient.range.min` / `.max`).
- **Legend size.** `ods-legend` is large by default. Scale its wrapper down and keep the title short; its placement is the Page's decision, the Widget cannot be resized by `odswidget-*` CSS (rulebook).
- **Never** `join-context`. **Never** a hard-coded year in the filter.

## Source Example Page

Beherbergungsstatistik der Gemeinden (`page_examples/Beherbergungsstatistik der Gemeinden/`): `ods-color-gradient` on `logiernachte` keyed by `gemeindenummer`, a layer on the Swiss boundaries dataset with `color-categories="colorgradient['colors']"`, `color-by-field="bfs_nummer"`, `color-categories-other="lightgrey"` and an `ods-legend`. The Example uses the older portal blues and `pow-exponent="0.2"`; the CI colours and per-dataset exponent here replace those.
