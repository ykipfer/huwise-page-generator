# Pattern 14: Empty-state guard

## Job

Show "Keine Daten für diese Auswahl" in place of a Visualization when the reader's filters leave no rows, instead of a blank chart or a row of dashes. It is needed whenever filter options do not depend on each other (Pattern 2's separate options context, a Page with a fixed time range, or a Companion Dataset), so that a combination can be empty. Pattern 1 dropdowns on one context normally cannot produce an empty combination, because each facet offers only values that exist under the other refines.

## Widgets

- `ods-results` (`widgets/data.md`) with `ods-results-max="1"` on the element that wraps the Visualizations, as the **probe**: its variable is empty exactly when the context has no rows.
- Core directives `ng-if` (`core.md`, "Guard rendering"). No other Widget.
- Any Widget that would show nothing useful on no rows (an `ods-aggregation` KPI, an `ods-chart`) sits inside the positive `ng-if`.

The empty-state message uses the base stylesheet's `.hw-empty` class (centred, dashed border, muted colour); the Page adds no CSS for it.

## Snippet

```html
<div class="hw-body hw-shape-single" ods-results="{probe_variable}" ods-results-context="datactx" ods-results-max="1">
  …
  <div class="hw-kpi" ng-if="{probe_variable}.length" ods-aggregation="{kpi_variable}" ods-aggregation-context="datactx"
       ods-aggregation-function="SUM" ods-aggregation-expression="{kpi_field}">
    <p class="hw-kpi-value">{{ {kpi_variable} | number:0 }}</p>
    <p class="hw-kpi-label">{kpi_label}</p>
  </div>
  <div class="hw-kpi" ng-if="!{probe_variable} || {probe_variable}.length === 0">
    <p class="hw-kpi-value">–</p>
    <p class="hw-kpi-label">{kpi_label}</p>
  </div>
  …
  <div class="hw-card">
    <p class="hw-card-title">{card_title}</p>
    <div class="hw-chart-area" ng-if="{probe_variable}.length">
      <ods-chart> … </ods-chart>
    </div>
    <div class="hw-chart-area" ng-if="!{probe_variable} || {probe_variable}.length === 0">
      <div class="hw-empty">Keine Daten für diese Auswahl</div>
    </div>
  </div>
  …
</div>
```

Placeholders:

- `{probe_variable}`: the variable of the probe (`treffer`). Pick a name of your own; never the default `results`.
- `{kpi_variable}`, `{kpi_field}`, `{kpi_label}`, `{card_title}`: as in the other Patterns. The empty KPI shows an en dash; keep its label.
- The empty message is always **"Keine Daten für diese Auswahl"** (rulebook: content rules). Do not add exclamation marks or advice.

`ods-results-max="1"` is enough: the probe only has to tell "no rows" from "some rows".

## Pitfalls

- **Put every Widget that reads or shows the data inside the positive `ng-if`.** A KPI aggregation or a chart over no rows has nothing to show, and the verifier reports it (`widget-variable`, `chart-no-points`). Inside the positive `ng-if` they do not exist in the empty state.
- **Keep the empty branch in the same area** (`hw-chart-area`, `hw-table-area`, `hw-map-area`). The fixed height of the layout must not change between the two states, or the Page overflows its Target Height in the empty state.
- **The guard is the form `!x || x.length === 0`**. The verifier recognises a guard written in `ng-if`, `ng-show` or `ng-hide` as `!x`, `!x.length` or `x.length === 0` and then accepts that `x` is empty in some states, with the **warning** `widget-variable-guarded` (one per excused variable, naming it; exit status stays 0). The warning is expected on a Page with an empty-state guard: it only says the empty state was reached. `NaN` is never excused. A guard that only handles the non-empty case (`ng-if="x.length"` alone) is **not** a guard: the empty variable is still reported as `widget-variable`, because it means the Page has no empty state.
- **`x` must be the probe's own variable**, the one named in `ods-results="x"`. A guard on a different name does not excuse it.
- **The probe's scope:** `ods-results` creates a child scope (`results.js:64`), so the guards must sit inside its element. Guards placed outside see `x` as undefined, so the empty message would show all the time.
- **The empty state must be reachable** by the verifier's state exploration (tab, ng-click or option states); an empty message that only appears after typing is never seen. The instance reaches it through the second dropdown's options (Dezember with the year 2026, whose data stops in August).
- If the empty state hides an `ods-select`, the reader cannot change the selection. Keep the filters **outside** the guarded areas.
- The message is a note, not an error colour. Do not use a status colour (rulebook: status colours).

## Source Example Page

Referenztarife für ausserkantonale, stationäre Spitalleistungen (`page_examples/Referenztarife für ausserkantonale, stationäre Spitalleistungen/`): the `nodata` block with "Keine Daten ausgewählt", shown by `ng-if="tarifdata.parameters['refine.gueltig_ab'].length === 0 || …"`. It tests the filter parameters rather than the data, and it asks the reader to choose something; the Pattern tests the data and says there is none.

## Proven instance

`patterns/instances/p14-empty-state/`: dataset `dvs_awt_econ_20250203` (Beherbergungsstatistik), Jahr and Monat dropdowns whose options come from an unfiltered context `optctx`, so "2026 / Dezember" is selectable and empty. The verifier explores that state (state "Dezember" after "2026", with the Page showing "Keine Daten für diese Auswahl") and reports no errors, at 375, 720 and 1200px (Gross). Its one finding is the expected warning `widget-variable-guarded` for `treffer`.
