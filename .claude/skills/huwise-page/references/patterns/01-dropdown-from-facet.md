# Pattern 1: Dropdown filter from facet values

## Job

Let the reader narrow the whole Page to one value of a text field (a Sportart, a Region, a Kategorie) with a dropdown whose options are the field's real values. Use it when the field has a modest number of distinct values (up to about 12, see Pitfalls) and the options may depend on the other filters. For a long list, or options that must not depend on the other filters, use Pattern 2.

Filters sit **above** the tabs and the Visualizations, in the `hw-filters` row of `hw-top` (never inside a tab). At most 2 filters fit when Narrow (rulebook: budget limits).

## Widgets

- `ods-dataset-context` (`widgets/context.md`): the main context `datactx`, with `'disjunctive.{facet_field}': true` in its parameters.
- `ods-facet-results` (`widgets/data.md`): lists the field's values with their counts into a named variable.
- `ods-select` (`widgets/filter.md`): the dropdown, **inside** the element that carries `ods-facet-results` (scope rule, `core.md`), writing `datactx.parameters['refine.{facet_field}']`.

## Snippet

```html
<ods-dataset-context context="datactx"
    datactx-dataset="{dataset_id}"
    datactx-parameters="{'disjunctive.{facet_field}': true}">
  …
  <div class="hw-filters">
    <div class="hw-filter" ods-facet-results="{options_variable}" ods-facet-results-context="datactx"
         ods-facet-results-facet-name="{facet_field}" ods-facet-results-sort="alphanum">
      <p class="hw-filter-label">{filter_label}</p>
      <ods-select options="{options_variable}" selected-values="datactx.parameters['refine.{facet_field}']"
          label-modifier="name + ' (' + count + ')'" value-modifier="name"
          placeholder="{all_label}"></ods-select>
    </div>
  </div>
  …
</ods-dataset-context>
```

Placeholders:

- `{dataset_id}`: the main dataset's ID.
- `{facet_field}`: the field name, as in the dataset (e.g. `anlagetyp`). It appears three times and must be identical.
- `{options_variable}`: any name that is not a Widget's default (`results`), e.g. `anlagetypen`. Use one per filter.
- `{filter_label}`: the German label, short (e.g. `Anlagentyp`).
- `{all_label}`: the German placeholder that means "no filter" (e.g. `Alle Anlagentypen`). Always set it: the default is English.

For a numeric facet (years, months) sort with `num` or `-num` instead of `alphanum`. Drop the counts (`label-modifier="name"`) when they would confuse more than help.

## Pitfalls

- **Without `disjunctive` the dropdown locks.** A facet counts values under the current refines, so once the reader picks a value the other options vanish and cannot be chosen. Verified on the Sportanlagen dataset: with the parameters empty, the options after picking "Fussball" no longer include "Curling". `'disjunctive.{facet_field}': true` keeps the field's own options in the list. It sits in the context's parameters, not on the Widget.
- **The `ods-select` must be inside the `ods-facet-results` element.** The options variable exists only there (scope rule). Outside it `options` is undefined and the dropdown stays empty.
- **Always `value-modifier="name"`.** The options are objects (`name`, `count`, `path`, `state`). Without the modifiers the refine receives the whole object and the API answers with an error.
- **The select holds an array.** `datactx.parameters['refine.{facet_field}']` is `[]` before a pick and `['value']` after it. Read the active value with `([].concat(x))[0]` (`core.md`). Clearing a single select means clicking the selected option again.
- **The verifier explores only the first 12 options** of a dropdown as states and reports the rest as warning `select-options-capped`. A facet with more than 12 values is not "clean": use Pattern 2 with a `limit`, or accept the warning on purpose.
- Name every `ods-facet-results` variable. Two filters that both use the default `results` shadow each other inside nested elements.
- A facet is a **v1** request: it takes `refine.*` and `disjunctive.*`, never ODSQL (`core.md`, "v1 parameters vs ODSQL").
- Use a second context for a Visualization that must ignore the filter (`core.md`, contexts).

## Source Example Page

NASAK- und KASAK-Sportanlagen Katalog (`page_examples/NASAK- und KASAK-Sportanlagen Katalog/`): three `ods-facet-results` + `ods-select multiple` filters on one context with `disjunctive.*` for each. The example styles its filters with `filter-item` classes and Font Awesome icons; the Pattern uses the base stylesheet's `hw-filter`, and it takes a single select.

## Proven instance

`patterns/instances/p01-dropdown-from-facet/`: dataset `dvs_awt_educ_20251002` (Sportanlagen), filter by `anlagetyp` (4 values), a KPI and a column chart of the Anlagen per Gemeinde. Verifier clean (no findings) at 375, 720 and 1200px (Gross) and in every explored option state.
