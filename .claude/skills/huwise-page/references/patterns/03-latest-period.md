# Pattern 3: Filter to the latest period

## Job

Show the newest period (usually the latest year) by default, so a Page stays current when data is updated, and still let the reader pick any other period. The year is **never typed**: it is computed from the data (`banned-hard-coded-year`). Clearing the dropdown restores the computed default, never "all periods".

Two variants. Both pass the same checks; they differ in where the latest period comes from:

| | Variant A: facet | Variant B: `max()` |
|---|---|---|
| Source of the latest period | the first entry of a facet sorted `-num` | `ods-adv-analysis` `max(<date field>)` |
| First paint | already filtered: the context is created with the default | one unfiltered request, then the default is written |
| Needs | a text or numeric period field (`jahr`) | a date field (`datum`) |
| Pick A when | the period field is a facet and the Page needs no flash of all data | the date field is the only source, or the period is not a facet |

Filters sit above the tabs (`hw-filters`), as in Pattern 1.

## Widgets

- `ods-dataset-context` (`widgets/context.md`): `datactx` for the Page and `yearctx` (A) or `latestctx` (B), a second context on the same dataset **without refine**, for the period list and the latest value.
- `ods-facet-results` (`widgets/data.md`): the period list, sorted `-num` (A and B).
- `ods-adv-analysis` (`widgets/data.md`): `max(…)` for the latest date (B only).
- `ods-select` (`widgets/filter.md`): the dropdown, writing `datactx.parameters['refine.{period_field}']`.
- The **guarded default**, one of the two allowed side-effect forms (`core.md`, "Side effects"), in the text of a hidden element.

## Snippet: Variant A (facet, then `ng-if`, then initial parameters)

```html
<ods-dataset-context context="yearctx" yearctx-dataset="{dataset_id}">
  <div ods-facet-results="{periods_variable}" ods-facet-results-context="yearctx"
       ods-facet-results-facet-name="{period_field}" ods-facet-results-sort="-num">
    <ods-dataset-context ng-if="{periods_variable}.length" context="datactx"
        datactx-dataset="{dataset_id}"
        datactx-parameters="{'refine.{period_field}': ''+{periods_variable}[0].name}">
      <div class="hw-page">
        …
        <div class="hw-filter">
          <p class="hw-filter-label">{filter_label}</p>
          <span hidden>{{ datactx.parameters['refine.{period_field}'] = datactx.parameters['refine.{period_field}'].length ? datactx.parameters['refine.{period_field}'] : [''+{periods_variable}[0].name]; '' }}</span>
          <ods-select options="{periods_variable}" selected-values="datactx.parameters['refine.{period_field}']"
              label-modifier="name" value-modifier="name"
              placeholder="{pick_label}"></ods-select>
        </div>
        …
      </div>
    </ods-dataset-context>
  </div>
</ods-dataset-context>
```

## Snippet: Variant B (`max()` plus the guarded default)

```html
<ods-dataset-context context="datactx, latestctx"
    datactx-dataset="{dataset_id}"
    latestctx-dataset="{dataset_id}">
  <div class="hw-page">
    …
    <div class="hw-filter" ods-adv-analysis="latest" ods-adv-analysis-context="latestctx"
         ods-adv-analysis-select="max({date_field}) as {date_field}">
      <p class="hw-filter-label">{filter_label}</p>
      <div ng-if="latest.length">
        <span hidden>{{ datactx.parameters['refine.{period_field}'] = datactx.parameters['refine.{period_field}'].length ? datactx.parameters['refine.{period_field}'] : [(latest[0].{date_field} | moment:'YYYY')]; '' }}</span>
        <div ods-facet-results="{periods_variable}" ods-facet-results-context="latestctx"
             ods-facet-results-facet-name="{period_field}" ods-facet-results-sort="-num">
          <ods-select options="{periods_variable}" selected-values="datactx.parameters['refine.{period_field}']"
              label-modifier="name" value-modifier="name"
              placeholder="{pick_label}"></ods-select>
        </div>
      </div>
    </div>
    …
  </div>
</ods-dataset-context>
```

Placeholders:

- `{dataset_id}`: the main dataset's ID. `{period_field}`: the period facet (`jahr`). `{date_field}` (B): the date field the year comes from (`datum`). `{periods_variable}`: a name of your own (`jahre`). `{filter_label}`: `Jahr`. `{pick_label}`: a German placeholder (`Jahr wählen`).
- The `'YYYY'` format in B is the **format string for a year**, not a year. Use `'MMM YYYY'` to display a month, but refine on the field's real precision.

## Pitfalls

- **The default must be an array.** `ods-select` calls `.forEach` on its value, so a scalar written after the Widget linked throws (`$scope.selectedValues.forEach is not a function`, `select.js:413`) and the dropdown dies while the data is already filtered. Write `[x]`. In A the initial parameter may be a scalar because the Widget wraps one at link (`select.js:379-380`).
- **Test emptiness with `.length`, not `||`.** `ods-select` writes `[]` at start and when cleared, and `[]` is truthy, so `x = x || default` never restores the default (observed: after clearing, the Page showed all years). The guarded default's `.length ? x : default` form is allowed by the lint (`core.md`).
- **Let the select link after the default exists.** In B the `ods-select` sits inside `ng-if="latest.length"`, so the latest value is known and the default is written by the time the select starts. The instance proves this arrangement; don't move the select out of the `ng-if`.
- **Period lists and the latest value come from a context without refine** (`yearctx`, `latestctx`). On `datactx` the list shrinks to the picked year and `max()` would report the picked year's latest month.
- **No literal year anywhere**: not in `-parameters`, `-where` or `ng-init`. A threshold such as `>= 2000` is read as a year by the lint (`core.md`).
- **Check the first entry of the sorted facet against the data.** `-num` sorts by the facet name as a number, which suits year text such as `2026`. The Referenztarife example sorts a date field with `-alphanum`; whichever you use, the first entry must be the newest period.
- **`ng-if` on a context element**: everything that needs `datactx` (Widgets, the footer, the select) sits inside it (scope rule). A context created later starts its widgets later (Variant A shows nothing until the facet has loaded).
- A Visualization that must show *all* periods (a time series) uses its own unfiltered context (`trendctx`), not `datactx`.
- Do not use `parameters-from-context` to share the default (`core.md`).

## Source Example Page

Beherbergungsstatistik der Gemeinden (`page_examples/Beherbergungsstatistik der Gemeinden/`): an `ods-analysis` over the dataset sorted `-x`, then an unguarded `{{ ctx.parameters['refine.jahr'] = allyears.results[0].x.year; ctx.parameters['refine.monat'] = … ; "" }}` to default to the latest year and month. It has no way back to the default, uses `odsAnalysis` (off the closed list), and writes unguarded. The Pattern replaces it with the guarded default and the two variants above.

## Proven instances

Both on dataset `dvs_awt_econ_20250203` (Beherbergungsstatistik der Gemeinden, `jahr` and `datum`), each with a KPI and a column chart of the Logiernächte per Monat. Both verifier clean (no findings; neither tests a variable for emptiness, so no `widget-variable-guarded` warning) at 375, 720 and 1200px (Gross) and in every explored option state; neither contains a year literal. Checked in a real browser: the default shows the latest year, picking another year works, and clicking the picked year again (clearing) returns to the latest year.

- Variant A: `patterns/instances/p03a-latest-period-facet/`.
- Variant B: `patterns/instances/p03b-latest-period-max/`.
