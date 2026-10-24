# Pattern 4: Copy a filter to another context

## Job

Make one dropdown drive a second context, usually on another dataset, so that a Visualization or KPI on that context follows the same choice. The field may be named differently in the other dataset (`region` in the data, `name` in the Boundary Dataset), so the copy renames it. Use it for a Companion Dataset or a Boundary Dataset that must follow the Page's main filter; use the plain filter (Pattern 1 or 2) when only one context is involved.

## Widgets

- `ods-dataset-context` (`widgets/context.md`): the filtered context `datactx` and the follower, e.g. `geoctx` or `compctx` (`core.md`, naming convention).
- `ods-select` (`widgets/filter.md`), as in Pattern 1, bound to **`datactx`** (the source).
- The **one-way copy**, the second allowed side-effect form (`core.md`, "Side effects"), in the text of a hidden element.

## Snippet

```html
<ods-dataset-context context="datactx, {follower_context}"
    datactx-dataset="{dataset_id}"
    datactx-parameters="{'disjunctive.{source_field}': true}"
    {follower_context}-dataset="{follower_dataset_id}">
  …
  <div class="hw-filter" ods-facet-results="{options_variable}" ods-facet-results-context="datactx"
       ods-facet-results-facet-name="{source_field}" ods-facet-results-sort="alphanum">
    <p class="hw-filter-label">{filter_label}</p>
    <span hidden>{{ {follower_context}.parameters['refine.{target_field}'] = datactx.parameters['refine.{source_field}']; '' }}</span>
    <ods-select options="{options_variable}" selected-values="datactx.parameters['refine.{source_field}']"
        label-modifier="name" value-modifier="name"
        placeholder="{all_label}"></ods-select>
  </div>
  …
  <div class="hw-kpi" ods-aggregation="{kpi_variable}" ods-aggregation-context="{follower_context}"
       ods-aggregation-function="SUM" ods-aggregation-expression="{kpi_field}">
    <p class="hw-kpi-value">{{ {kpi_variable} | number:0 }}</p>
    <p class="hw-kpi-label">{kpi_label}</p>
  </div>
  …
</ods-dataset-context>
```

Placeholders:

- `{follower_context}`: the context that receives the copy (`geoctx`, `compctx`, `<name>ctx`). `{follower_dataset_id}`: its dataset. For a Boundary Dataset take the ID and key from `boundary-catalogue.md`.
- `{source_field}`: the field the reader filters on in the main dataset. `{target_field}`: the field in the follower dataset that holds the **same values**, which may be named differently.
- `{options_variable}`, `{filter_label}`, `{all_label}`: as in Pattern 1.
- `{kpi_variable}`, `{kpi_field}`, `{kpi_label}`: the follower's KPI; any Widget on the follower context works the same way.

In the `{{ }}` write the context name without braces, e.g. `geoctx.parameters['refine.name']`. The lint reads the interpolation: it must be exactly the one-way copy form.

## Pitfalls

- **One way only.** The lint rejects a copy back from the target (`side-effect`, two-way copy) and a target parameter copied from two source contexts. Copy from the one context the reader's dropdown writes to.
- **The values must really match.** The copy passes the array as it is, with no transformation (a transforming copy is outside the allowed forms). If the follower dataset spells the value differently (a code instead of a name), the follower shows nothing. Check the match with the MCP first; the instance checks it on Region names. The dry-run's key-coverage check covers map joins only (`boundary-catalogue.md`).
- **Do not use `parameters-from-context` instead.** It shares the whole parameter object, can't rename fields, is ignored when the context has its own `parameters`, and stops watching after the first copy (`dataset-context.js:92-106`).
- **An empty source is copied as empty.** Clearing the dropdown copies `[]`, which the follower treats as no filter. That is what you want: the follower shows its unfiltered total again.
- **The hidden span must sit in the scope where both contexts are visible**, i.e. inside the context element that declares both.
- Counts and KPIs on the follower are unfiltered by any other parameter. Only the copied field narrows it.

## Source Example Page

Referenztarife für ausserkantonale, stationäre Spitalleistungen (`page_examples/Referenztarife für ausserkantonale, stationäre Spitalleistungen/`): `{{ filtertarif.parameters['refine.bereich'] = tarifdata.parameters['refine.bereich']; '' }}` copies the Bereich filter to the contexts that supply the other dropdowns' options. The example writes its copies as chained assignments in visible text, which the lint refuses (`side-effect`); the Pattern uses the single copy form in a hidden element.

## Proven instance

`patterns/instances/p04-copy-filter/`: main dataset `dvs_are_soci_20250224` (Bauzonen, filter `region`), follower `geoctx` on the Region Boundary Dataset `dvs_awt_regi_20250211` (`name`, renamed from `region`), with a KPI of the Einwohnerzahl on `geoctx`. Verifier clean (no findings) at 375, 720 and 1200px (Gross) and in every explored option state. Checked in a real browser: picking "Albula" shows 607 ha and 8 117 Einwohner, clearing shows the Kanton's 7 401 ha and 204 888 Einwohner.
