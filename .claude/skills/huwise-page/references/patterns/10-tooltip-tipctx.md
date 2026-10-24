# Pattern 10: Map tooltip from a nested context

## Job

Show values from a **Companion Dataset** (or a different cut of the main one) in the tooltip of a map shape or point, looked up by the clicked record's key. The tooltip holds its own context, `tipctx`, nested inside the `ods-map-layer`.

Instance Page (proven): `patterns/instances/10-tooltip-tipctx/`: the Pattern 9 choropleth of `dvs_awt_soci_20260112`, whose tooltip shows the Gemeinde's latest Zweitwohnungs- and Erstwohnungsanteil. It passes the verifier, which clicks a shape (explored state "map shape click") and checks the tooltip's Widget variables.

## Widgets

`ods-map-layer` (its element content is the tooltip template), `ods-dataset-context` named `tipctx`, and `ods-adv-analysis` or `ods-results` over `tipctx` (`widgets/map.md`, `widgets/data.md`).

## Snippet

```html
<ods-map-layer context="geoctx" display="categories" … border-color="#FFFFFF" shape-opacity="1">
  <ods-dataset-context context="tipctx" tipctx-dataset="{tip_dataset_id}"
      tipctx-parameters="{'refine.{tip_key_field}': ''+record.fields.{boundary_key_field}}">
    <div class="hw-tip" ods-adv-analysis="last" ods-adv-analysis-context="tipctx"
         ods-adv-analysis-select="{field_a}, {field_b}, {period_field}"
         ods-adv-analysis-order-by="{period_field} DESC" ods-adv-analysis-limit="1">
      <p class="hw-tip-title">{{ record.fields.{name_field} }}</p>
      <p>{{ last[0].{field_a} | number:1 }}</p>
    </div>
  </ods-dataset-context>
</ods-map-layer>
```

- `record.fields.<field>` is the clicked shape's record of the layer's dataset. Cast the key with `''+`.
- Style the tooltip with the Page's own class (`.hw-tip`), never `odswidget-*` classes.

## Pitfalls

- **The tooltip sees only `record` and its own contexts.** It does not see the Page's contexts, variables or the gradient: the layer's scope is isolated and the template is compiled on its own (`widgets/map.md`). `datactx.parameters[…]` inside the tooltip is `undefined`; written into a refine it becomes the string `'undefined'` and the API answers 400. Look the value up again inside the tooltip.
- **Latest period.** Sort with ODSQL (`-order-by="jahr DESC"`), not with the context's `'sort'`: the v1 `sort` on a date field comes back in the opposite order on data.gr.ch (verified on `dvs_awt_soci_20260112`: `sort=-jahr` returns 2017 first, and a comma list is not honoured). Format a date field as `last[0].jahr | moment:'YYYY'`.
- **A shape without a record.** If `tipctx` finds no rows, `ods-results` over it is empty and the render stage reports `widget-variable` in the click state. The verifier clicks the first shape only, so guard the content anyway: `ng-if="last.length"` around the values and "Keine Daten" otherwise.
- Keep the tooltip short (4 lines). It must fit a 280px map at 375px width.
- The widgets inside a tooltip render only on click. The render stage explores them by clicking the first shape or marker of each map; a Widget in a tooltip that no click reaches is `widget-never-rendered`.

## Source Example Page

Beherbergungsstatistik der Gemeinden (`page_examples/Beherbergungsstatistik der Gemeinden/`): the layer's custom tooltip with a nested `selected` context (`selected-parameters="{'refine.gemeindenummer':''+record.fields.bfs_nummer}"`) and `ods-results` for the latest values. The tooltip follows the CI classes here.
