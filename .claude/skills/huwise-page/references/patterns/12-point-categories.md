# Pattern 12: Point map with category colours

## Job

Show points coloured by a category field, with the layer's own legend (caption).

Instance Page (proven): `patterns/instances/12-point-categories/` on `dvs_awt_educ_20251002` (Sportanlagen by `anlagetyp`, four values), with a KPI and a Sportart filter. It passes the verifier at every width and in every filter state; the dry-run checks the colour map against the real facet values.

## Widgets

`ods-map`, `ods-map-layer` (`widgets/map.md`). The instance adds `ods-aggregation`, `ods-facet-results` and `ods-select`.

## Snippet

```html
<ods-map location="8,46.75,9.6" scroll-wheel-zoom="false" toolbar-geolocation="false" toolbar-drawing="false">
  <ods-map-layer context="datactx" display="categories"
      color-by-field="{category_field}"
      color-categories="{'{value_1}': '#2D2D8A', '{value_2}': '#E69F00', '{value_3}': '#009E73', '{value_4}': '#56B4E9'}"
      color-categories-other="#6B6B6B"
      size="6" caption="true" caption-title="{legend_title}" tooltip-disabled="true"></ods-map-layer>
</ods-map>
```

- Colours follow the CI order (`#2D2D8A, #E69F00, #009E73, #56B4E9, #CC79A7, #0072B2, #D55E00`); `#6B6B6B` is "Übrige/Andere" and goes into `color-categories-other`. More than 7 values: group the rest into "Übrige" (rulebook).
- Add a tooltip with Pattern 11 when the points need details (drop `tooltip-disabled`).

## Pitfalls

- **Exact values.** Every key of `color-categories` must be the field's real value, character for character (`NASAK/KASAK (kantonale Bedeutung)`). A missing key falls back to the default palette silently; a surplus key is a dry-run error. The dry-run compares the map with the field's facet values.
- **Needs `color-by-field`**, or the Widget logs an error (`widgets/map.md`).
- **No `color` attribute** on the same layer: it wins over `color-categories`.
- Red is never a category colour (rulebook).
- A filter on the layer's own context changes the points. If it leaves no point, the render stage reports `map-no-features`; filter values come from the data (`ods-facet-results`), so each has at least one point.
- A filter with more than 12 options is explored only for its first 12 (warning `select-options-capped`).
- The caption sits bottom right and covers part of the map at 375px. If that hides the points, drop `caption` and name the colours in the card title.

## Source Example Page

NASAK- und KASAK-Sportanlagen Katalog (`page_examples/NASAK- und KASAK-Sportanlagen Katalog/`): the `katalog` layer with `color-categories` by `anlagetyp` and `caption="true"`. The Example's red-based colours are replaced by the CI order.
