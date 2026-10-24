# Pattern 6: Column, bar or line chart with a breakdown

## Job

Show how a value develops or compares: a column, bar or line chart over time or over categories, optionally split into stacked series by a second field ("Logiernächte nach Herkunftsland und Jahr"). Use it when the reader should see shape and size at a glance. A chart sits in the Page's one large area (a card, or a tab, Pattern 8) and fills `hw-chart-area`.

## Widgets

- `ods-chart` > `ods-chart-query` > `ods-chart-serie` (`widgets/chart.md`).
- `series-breakdown` on the query splits every series by the values of one field; `stacked="normal"` stacks them; `category-colors` on the same query gives each breakdown value its colour.
- The chart is **directly** inside `hw-chart-area` (lint `no-fixed-height`). The base stylesheet fills the area with the chart (`.ods-chart { height: 100% }`).

## Snippet

```html
<div class="hw-card">
  <p class="hw-card-title">{chart_title}</p>
  <div class="hw-chart-area">
    <ods-chart timescale="year">
      <ods-chart-query context="{main_context}" field-x="{x_field}" timescale="year" stacked="normal" series-breakdown="{breakdown_field}"
          category-colors="{'{value_one}': '#2D2D8A', '{value_two}': '#E69F00'}">
        <ods-chart-serie expression-y="{y_field}" function-y="{function}" chart-type="column" label-y="{y_label}"></ods-chart-serie>
      </ods-chart-query>
    </ods-chart>
  </div>
</div>
```

Placeholders:

- `{main_context}`: `datactx` by default. The context's parameters may carry a literal filter (below).
- `{x_field}`: a date field (then keep `timescale`) or a category field (then drop both `timescale` attributes). For a category x-axis with `series-breakdown`, the chart is stacked by the breakdown.
- `{breakdown_field}`: the field that splits the series. Drop `series-breakdown`, `stacked` and `category-colors` for a single series, and add `color="#2D2D8A"` on the serie (a single series is always `#2D2D8A`).
- `{value_one}`, `{value_two}`: the field's **real** values, one entry per value, written exactly as the data has them. Colours follow the CI order: `#2D2D8A, #E69F00, #009E73, #56B4E9, #CC79A7, #0072B2, #D55E00`. Red is never a category colour.
- `{function}`: `SUM`, `AVG`, `MIN`, `MAX` or `COUNT`. Use `AVG` for a stock that is reported monthly (people registered, a rate); `SUM` for a flow (nights, arrivals).
- `{chart_title}`, `{y_label}`: German, with the unit once.

`chart-type` is `column`, `bar` or `line` (`stacked` works with all three). Horizontal `bar` needs the categories on x.

### More than 7 categories (stacked charts)

The colour order has 7 entries. **Rule: a stacked chart shows the 7 largest categories, and the rest goes into a KPI.** There is no "Übrige" series in a stacked chart: the Widgets cannot merge categories (no "top N plus the rest" option), and a second `ods-chart-query` that draws "Übrige" as one grey series does not stack on top of the first (ods-widgets 2.1.2 gives a query without `series-breakdown` no stacking in the observed render, `series.options.stacking` is `null`), so the grey bar would stand beside the stack. What works, verified through the dry-run and the render stage:

- Restrict the chart's context to the 7 largest values with literal parameters, so the map keys and the data match: `datactx-parameters="{'disjunctive.{breakdown_field}': true, 'refine.{breakdown_field}': ['{value_one}', … seven values]}"`. The dry-run checks `category-colors` against the values this filter leaves.
- Say in the plan list that the remaining categories are not charted, and show their total in a KPI (Pattern 5) on a second context with the matching `exclude.{breakdown_field}` list.
- Do not draw "Übrige" as a series. Flag this to the reader of the plan: it applies to stacked charts only (`#6B6B6B` for "Übrige" stays valid where a Visualization can draw it, such as a map's `color-categories-other`).

## Pitfalls

- A key missing from `category-colors`, or an extra one, silently falls back to the default palette (`Set2`). The dry-run reports `dry-run-colour-map-mismatch`; check it against the field's real values (`facet values`), never from memory.
- The dry-run checks the colour map against the values the context's **literal** `refine`/`exclude` defaults leave. A filter that writes `refine.{breakdown_field}` at runtime (an `ods-select`, say) can bring back values the map does not name, and the check passes anyway. A filter on the breakdown field must not widen beyond the mapped values.
- `category-colors` is evaluated as an expression (`highcharts.js:2233`): use single quotes inside the double-quoted attribute.
- With `series-breakdown` the keys are the breakdown values, without it the x values (`highcharts.js:639,1382`).
- `range-custom` and ColorBrewer names are not CI colours. For a single colour use a hex; for series use `category-colors`.
- Highcharts here is **6.1.4**, not 11 (`core.md`). Do not rely on newer Highcharts options.
- `single-y-axis="false"` still turns the single axis on (`core.md`, chart notes). Leave the attribute off.
- The platform appends a timezone caption ("Alle Daten und Zeiten sind im Zeitformat Europe/Zurich angegeben") inside the chart, below the plot, in the platform's language mix. It is not part of the fixed-height area, so at phone width it runs into the footer. The base stylesheet hides it (`.chart-timezone-caption`); the Page adds no CSS for it.
- A monthly dataset aggregated per year with `SUM` double counts stocks (people registered): use `AVG`. The latest year is incomplete: say so in the label only if it matters, never cut it off by hand.
- Long legends wrap and take height from the plot. Keep breakdown values to the 7 above and the card title to one line at 375px.
- Never set a height on the chart or its parents yourself, and never use `vh`.

## Source Example Page

Mittelverwendung im Bereich Landeslotterie (`page_examples/Mittelverwendung im Bereich Landeslotterie/`): stacked column chart with `series-breakdown`. Styling follows the AWT Design System (the base stylesheet), not that Page's CSS.

Instance Page (verified on a real dataset): `patterns/instances/06-chart/`, dataset `dvs_kiga_econ_20260128` (Arbeitslose und Stellensuchende ab 1993), two stacked series with `category-colors` and a literal `refine` on `metrik`. It passes `verify.mjs` clean at 375, 720 and 1200px, including the dry-run's colour-map check against the filtered values.
