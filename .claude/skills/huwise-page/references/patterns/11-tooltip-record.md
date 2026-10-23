# Pattern 11: Map tooltip from the layer's own record

## Job

Show the fields of the clicked point or shape itself in its tooltip, without a second request. Use it when the layer's dataset already holds everything the tooltip needs (a catalogue of sites, for example). If the tooltip needs another dataset, use Pattern 10.

Instance Page (proven): `patterns/instances/11-tooltip-record/` on `dvs_awt_educ_20251002` (Sportanlagen, 26 points): a KPI, a filter on the type, and a map whose tooltip shows name, Sportart, Gemeinde, type and Trägerschaft. The verifier clicks a marker (state "map shape click") and checks the tooltip for unresolved text.

## Widgets

`ods-map`, `ods-map-layer` (`widgets/map.md`); the tooltip content is plain HTML with interpolation. The instance also uses `ods-aggregation`, `ods-facet-results` and `ods-select` for the KPI and filter (`widgets/data.md`, `widgets/filter.md`).

## Snippet

```html
<ods-map-layer context="datactx" display="categories" color="#2D2D8A" size="6">
  <div class="hw-tip">
    <p class="hw-tip-title">{{ record.fields.{title_field} }}</p>
    <p>{{ record.fields.{field_a} }}, {{ record.fields.{field_b} }}</p>
  </div>
</ods-map-layer>
```

CSS: `.hw-page .hw-tip { font-size: 12px; line-height: 1.35; }` and `.hw-tip-title { font-weight: 700; color: var(--hw-brand); }`.

## Pitfalls

- **Only `record.fields`.** Nothing of the Page's scope is visible in the tooltip, only `record` (fields of the layer's dataset) and contexts declared inside it (`widgets/map.md`).
- **Missing values.** An empty field prints nothing, so "Trägerschaft: " can stand alone. Wrap optional lines in `ng-if="record.fields.x"`.
- **Date fields** arrive as ISO strings: format with `| moment:'DD.MM.YYYY'` only where a date is allowed (rulebook: content rules); otherwise show `MMM YYYY`.
- **Stacked points.** Points at the same place show several records in one tooltip. `tooltip-sort` sets their order.
- **Long text.** Keep the tooltip under about 5 lines. Never a table.
- Colour attributes: `color` wins over every other colour attribute (`widgets/map.md`). A layer that sets `color` cannot also be a category map.

## Source Example Page

NASAK- und KASAK-Sportanlagen Katalog (`page_examples/NASAK- und KASAK-Sportanlagen Katalog/`): the `katalog` layer's `map-tooltip` template with `record.fields.anlagenbezeichnung`, `gemeinde`, `sportart`, `traegerschaft`. Its tooltip CSS is replaced by the Page's own `.hw-tip` classes.
