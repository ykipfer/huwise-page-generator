# Pattern 2: Dropdown filter from distinct values (`group-by`)

## Job

Let the reader filter by a field whose options come from an ODSQL `group by`, with an explicit `limit`. Use it instead of Pattern 1 when the options must **not** depend on the other filters, when the list needs its own order (`order by`), or when the facet is not available as a facet. Like Pattern 1 the filter sits above the tabs, in `hw-filters`.

## Widgets

- `ods-dataset-context` (`widgets/context.md`): the main context `datactx` **and** a second context on the same dataset, `optctx`, that never receives a refine. It exists only to feed the options.
- `ods-adv-analysis` (`widgets/data.md`): `-select`, `-group-by`, `-order-by` and an explicit `-limit`, on `optctx`.
- `ods-select` (`widgets/filter.md`): **inside** the `ods-adv-analysis` element, writing `datactx.parameters['refine.{group_field}']`.

## Snippet

```html
<ods-dataset-context context="datactx, optctx"
    datactx-dataset="{dataset_id}"
    optctx-dataset="{dataset_id}">
  …
  <div class="hw-filters">
    <div class="hw-filter" ods-adv-analysis="{options_variable}" ods-adv-analysis-context="optctx"
         ods-adv-analysis-select="count(*) as anzahl" ods-adv-analysis-group-by="{group_field}"
         ods-adv-analysis-order-by="{group_field} ASC" ods-adv-analysis-limit="{option_limit}">
      <p class="hw-filter-label">{filter_label}</p>
      <ods-select options="{options_variable}" selected-values="datactx.parameters['refine.{group_field}']"
          label-modifier="{group_field}" value-modifier="{group_field}"
          placeholder="{all_label}"></ods-select>
    </div>
  </div>
  …
</ods-dataset-context>
```

Placeholders:

- `{dataset_id}`: the main dataset's ID, twice.
- `{group_field}`: the field to list. It appears in `-group-by`, `-order-by`, both modifiers and the refine, and must be identical. The rows are flat (`row.region`), so the modifiers are the bare field name.
- `{options_variable}`: a name of your own (e.g. `regionen`).
- `{option_limit}`: a number at least as large as the number of distinct values (e.g. `20` for 11 Regionen). Count them first with the MCP.
- `{filter_label}`, `{all_label}`: German label and "no filter" placeholder.

The `-select` holds an aggregate (`count(*) as anzahl`), as in the Widget's documented `group-by` use. The aggregate itself is not shown.

## Pitfalls

- **Run the options on a separate context.** `ods-adv-analysis` converts the context's v1 parameters into its `where`, so on `datactx` the list shrinks to the picked value as soon as the reader picks one. Verified on the Bauzonen dataset: with `ods-adv-analysis-context="datactx"`, after picking "Albula" no other Region can be chosen. `optctx` has no refine, so the list stays complete. (Pattern 1 gets the same effect from `disjunctive`, which a `group by` does not honour.)
- **Always set `ods-adv-analysis-limit`** (`core.md`). Without `group-by` the Widget forces the limit to 1 (`advanced-analysis.js:136`); with it and no limit the API applies its own cap, and a list longer than the cap silently loses options. An explicit number makes the cut a decision. Groups whose value is null are dropped by the Widget (`advanced-analysis.js:152-153`).
- The cap on explored states is 12 options. A list with more values is reported as warning `select-options-capped`.
- The variable is the bare array. Read `row.region`, not `row.fields.region`, and not `result.results` as the docs say (`core.md`).
- `ods-select` must sit inside the `ods-adv-analysis` element (scope rule), and the options need `label-modifier` and `value-modifier`.
- The refine is a v1 `refine.<field>` on `datactx`. The ODSQL stays in the `ods-adv-analysis-*` attributes, and only there. Dry-run a literal ODSQL clause through the MCP's `get_records` before writing it.

## Source Example Page

Dashboard Überbauungsstand (`page_examples/Dashboard Überbauungsstand/`): two `ods-adv-analysis` dropdowns (Region, Gemeinde) with `count(distinct …)` and `group-by`. The example puts the options on the filtered context and sets no `limit`; the Pattern corrects both and uses the base stylesheet instead of Bootstrap `col-md-4` and `ods-box`.

## Proven instance

`patterns/instances/p02-dropdown-from-group-by/`: dataset `dvs_are_soci_20250224` (Bauzonen und Stand der Überbauung), filter by `region` (11 values, `limit` 20), a KPI and a column chart. Verifier clean (no findings) at 375, 720 and 1200px (Gross) and in every explored option state.
