# Pattern 5: KPI tile

## Job

Show one number that answers one question ("how many Logiernächte?") in the base stylesheet's KPI card. Use it for a total, an average, a maximum or a count over the whole dataset or over what the filters leave. At most 4 tiles fit the top row (rulebook: budget limits); two per row below 480px.

## Widgets

- `ods-aggregation` (`widgets/data.md`): computes one number through the v1 analyze API with the context's parameters, so every filter on the same context changes the tile.
- The tile is the base stylesheet's `hw-kpi` with `hw-kpi-value` (26px, brand blue) and `hw-kpi-label` (12px, muted). It sits in `.hw-kpis`, inside `.hw-top`, so it is one of the first elements of the body.

The `ods-aggregation` attribute goes on the **tile element itself**, so the number is visible in the tile and nowhere else (the variable lives in the child scope the Widget creates, `aggregation.js:92`). Every tile can use the same variable name for that reason.

## Snippet

```html
<div class="hw-kpi" ods-aggregation="kpi_value" ods-aggregation-context="{main_context}" ods-aggregation-function="{function}" ods-aggregation-expression="{field_name}">
  <p class="hw-kpi-value">{{ kpi_value | number:{decimals} }}</p>
  <p class="hw-kpi-label">{label}</p>
</div>
```

Placeholders:

- `{main_context}`: the context name, `datactx` by default (without braces in the attribute).
- `{function}`: `SUM`, `AVG`, `MIN`, `MAX` or `COUNT`. A `COUNT` of rows needs no expression: drop the `ods-aggregation-expression` attribute.
- `{field_name}`: the real field name from the dataset's fields, in snake_case.
- `{decimals}`: `0` for counts and sums, `1` for averages and rates.
- `{label}`: German, with the unit written once, short enough for one line (the label truncates with an ellipsis at 375px).

Several tiles on one context work independently. Put them in the base stylesheet's row:

```html
<div class="hw-top">
  <div class="hw-kpis">
    <!-- one hw-kpi per tile, at most 4 -->
  </div>
  <div class="hw-filters"><!-- filters --></div>
</div>
```

## Pitfalls

- The number format `number:0` uses the `de-ch` locale and prints `30’144’502`. Never format by hand.
- `ods-aggregation` yields `null` when there are no rows (`aggregation.js:128`), which renders as an empty value. A filter combination without data therefore shows a blank tile. Add an empty-state only when the Page can reach such a combination.
- Do not read `kpi_value` outside the tile: the variable does not exist there (scope rule, `core.md`). To show one number twice, aggregate twice.
- An average of an average is not the average. `AVG` of a rate field (such as `bruttozimmerauslastung`) is only honest when every row has the same weight; say "Durchschnitt" in the label when it is one.
- Aggregating a whole time range is fine, but a tile that says "aktuell" or "letztes Jahr" must filter to the latest period computed from the data (Pattern 3), never to a typed year (`banned-hard-coded-year`).
- Do not give the tile a fixed width or height of its own. The base stylesheet sizes it from `--hw-kpi-h`, and the budget assumes that.
- Do not copy `ods-aggregation` onto a `<p>` inside the tile: it then creates its own scope and the sibling `<p>` cannot read the number.

## Source Example Page

Mittelverwendung im Bereich Landeslotterie (`page_examples/Mittelverwendung im Bereich Landeslotterie/`): its `ods-aggregation` KPI. Styling follows the AWT Design System (the base stylesheet), not that Page's CSS.

Instance Page (verified on a real dataset): `patterns/instances/05-kpi/`, dataset `dvs_awt_econ_20250203` (Beherbergungsstatistik der Gemeinden), four tiles (Logiernächte, Ankünfte, Aufenthaltsdauer, Zimmerauslastung), a Jahr filter and a table. It passes `verify.mjs` clean at 375, 720 and 1200px with every Jahr option explored.
