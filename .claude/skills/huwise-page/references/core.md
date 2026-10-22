# Core reference: Widgets, contexts and expressions

Always read this file before writing a Page. It holds the rules every Page follows. Per-Widget parameters live in the Widget family files. Source citations point into the owner's gitignored ods-widgets checkout (`ods-widgets/src/…`, version 2.1.2, the version data.gr.ch serves).

The verifier reads the closed Widget list from `widgets.json` and the banned habits from `banned-habits.json`. This file explains them. If you change either JSON file, update this file too: a test checks that every Widget and habit id appears here.

## The closed-list rule

A Page uses **only** these 18 Widgets. Anything else with an `ods-` name is a lint error (`unlisted-widget`). The list holds every Widget the Example Pages use, minus `odsAnalysis` (its documented default variable is wrong, it calls the v1 analyze API, and `ods-facet-results` and `ods-aggregation` do its jobs better).

| Family | Widgets (markup, form) |
|---|---|
| context | `ods-dataset-context` (element) |
| data | `ods-results`, `ods-facet-results`, `ods-adv-analysis`, `ods-aggregation` (attributes); `ods-table`, `ods-gauge` (elements) |
| filter | `ods-select`, `ods-text-search` (elements) |
| chart | `ods-chart` > `ods-chart-query` > `ods-chart-serie` (elements, nested in that order) |
| map | `ods-map` > `ods-map-layer` (elements); `ods-color-gradient` (attribute); `ods-legend` (element) |
| tabs | `ods-simple-tabs` > `ods-simple-tab` (elements) |

- An attribute Widget's parameters sit on the **same element** and carry its name as a prefix: `ods-results-max` next to `ods-results`, `ods-adv-analysis-select` next to `ods-adv-analysis`.
- Platform-only directives (`ods-tabs`, `ods-pane`, `ods-import-script`, `ods-agent`, …) are not in the list and are never used.
- If a Page Request needs a Widget that is missing, flag it in the plan list. It joins only through the deliberate add step: write the entry, prove it renders through the verifier, then add it to `widgets.json`. Never improvise one.
- When this reference and the family file are both silent, you may read `ods-widgets/src` for a **listed** Widget. Report the gap to the owner and propose an addition; don't edit the reference yourself.

## Contexts

A context is a named connection to one dataset plus a set of query parameters. Every data Widget reads through one.

```html
<ods-dataset-context context="datactx, geoctx"
    datactx-dataset="dvs_awt_econ_20250203"
    datactx-parameters="{'disjunctive.gemeinde_name': true, 'sort': 'datum'}"
    geoctx-dataset="dvs_awt_regi_202502110">
  … Widgets using context="datactx" …
</ods-dataset-context>
```

- `context` lists the names. Each name gets `<name>-dataset` (`dataset-context.js:156-161`) and optionally `<name>-parameters` (`dataset-context.js:213`).
- The context object has `parameters` (v1 query parameters, see below), `dataset` (schema and metas, e.g. `datactx.dataset.metas.data_processed` for "Letzte Aktualisierung") and `nhits`.
- Changing `ctx.parameters` re-runs every Widget on that context. Filters work this way: `ods-select selected-values="datactx.parameters['refine.gemeinde_name']"` writes the refine, and every chart, KPI and table on `datactx` follows.
- **The context exists only inside its element** (`scope: true`, `dataset-context.js:145`). Put the Widgets that use it inside it.
- Two contexts on the same dataset are independent. Use that when one Visualization must ignore a filter, e.g. a time series that should not be filtered to the latest year.
- To make a context wait for a value (such as the latest year), create it inside `ng-if="jahre.length"`. Its initial parameters are then computed from data that already exists, as in Pattern 3A.
- `parameters-from-context` is **not** a way to share filters. It shares the whole parameter object, can't rename fields, is ignored when the context has its own `parameters`, and stops watching after the first copy (`dataset-context.js:92-106`). Use the one-way copy instead.

### Context naming convention

Patterns combine without renaming because every Page uses the same names:

| Name | Holds |
|---|---|
| `datactx` | the main dataset |
| `geoctx` | the Boundary Dataset of a map |
| `tipctx` | a tooltip context nested inside `ods-map-layer` |
| `compctx` | the Companion Dataset |
| `<name>ctx` | any other context, e.g. `trendctx` for an unfiltered time series |

## The scope rule

Most data Widgets create a **child scope**. Their variable is visible only on that element and its descendants:

- `ods-results` (`results.js:64`), `ods-facet-results` (`facet-results.js:54`), `ods-aggregation` (`aggregation.js:92`), `ods-adv-analysis` (`advanced-analysis.js:118`) and `ods-dataset-context` (`dataset-context.js:145`) all declare `scope: true`.
- `ods-color-gradient` creates **no** child scope. It writes its variable into the enclosing scope (`analysis.js:299-300`).
- `ods-simple-tab` puts its content under an `ng-if` (`simple-tabs.js:103`), so each tab is a child scope. With the default `keep-content="false"` the content is destroyed and rebuilt on every tab change (`simple-tabs.js:83,110`). Leave it that way for maps, which need the rebuild to size correctly.

Consequences:

- Nest what reads a variable **inside** the element that defines it: the `ods-select` goes inside the `ods-facet-results` that provides its options, and the KPI text goes inside the `ods-aggregation`.
- Never assign to a plain scope variable to "export" a value. A write from inside a child scope creates a new variable in that child scope. The parent never sees it, and an `ng-repeat` over it elsewhere silently renders nothing.
- Pass state between places only through **context parameters**, which are shared objects. That is why both allowed side-effect forms write only into `ctx.parameters`.

## v1 parameters vs ODSQL

Pages mix two query dialects:

- **v1 context parameters** live in `ctx.parameters` and in `<name>-parameters`: `refine.<field>`, `exclude.<field>`, `disjunctive.<field>`, `sort`, `q`. `ods-results`, `ods-facet-results`, `ods-aggregation`, `ods-table`, `ods-chart` and `ods-map` send them to the v1 API.
- **ODSQL** (Explore v2.1) appears only in `ods-adv-analysis-select / -where / -group-by / -order-by / -limit`. `ods-adv-analysis` converts the context's v1 parameters to v2.1 and adds its own clauses (`advanced-analysis.js:122-123`).
- The data.gr.ch MCP speaks only ODSQL and v2.1 (`refine: "field:value"`). Translate what you learn from it into the Widgets' dialect:

| MCP / v2.1 | Widget v1 context parameter | Notes |
|---|---|---|
| `refine: field:"value"` | `'refine.field': 'value'` | An array gives several values. Converted back by `api-params-v1-to-v2.js:59-68`. |
| `exclude: field:"value"` | `'exclude.field': 'value'` | `api-params-v1-to-v2.js:70-79` |
| `facet(name="field", disjunctive=true)` | `'disjunctive.field': true` | Lets an `ods-select multiple` combine values with OR. In v2.1 it is only sent for a field that is also refined or excluded (`api-params-v1-to-v2.js:104-115`). |
| `where` (ODSQL condition) | none | Use `refine.<field>` for equality. For anything else, use `ods-adv-analysis-where` on that Widget only. |
| `select` with aggregates, `group_by` | none | `ods-adv-analysis-select` / `-group-by` (ODSQL), or `ods-aggregation-function` + `-expression` (v1 analyze). |
| `order_by` | `'sort': 'field'` | ODSQL ordering applies only in `ods-adv-analysis-order-by`. Facet order: `ods-facet-results-sort` (`count`, `num`, `alphanum`; a `-` prefix sorts descending, `facet-results.js:15-21`). |
| full-text `q` | `'q': '…'` → sent as `qv1` | Banned as a filter (`q-filter`; `api-params-v1-to-v2.js:45-48,119-121`). |

- Date fields refine by period string. A field with year precision takes the year as a string, as `ods-facet-results` returns it (`jahre[0].name`). Build it from data, never as a literal.
- `ods-adv-analysis` without `group-by` forces `limit = 1` (`advanced-analysis.js:136`). With `group-by`, always set an explicit `ods-adv-analysis-limit`.
- Its variable is the bare result array: `latest[0].jahr`, not `latest.results[0]` as its docs say.
- Dry-run every literal ODSQL query through the MCP's `get_records` before writing it into the Page.

## Expression idioms

- **Bind a filter:** `selected-values="datactx.parameters['refine.gemeinde_name']"`.
- **Read the active filter value**, which may be a string or an array: `([].concat(datactx.parameters['refine.jahr']))[0]`.
- **Cast keys and refine values to strings with `''+`:** `'refine.jahr': ''+jahre[0].name`, and `'refine.bfs_nummer': ''+record.fields.gemeindenummer` in a tooltip context. Integer and text keys (`gemeindenummer` vs `bfs_nummer`) only match as strings.
- **Record fields:** `row.fields.name` for `ods-results` rows and `record.fields.name` in map-layer tooltips. `ods-adv-analysis` rows are flat: `rows[0].total`.
- **Guard rendering:** use `ng-if="rows.length"` before reading `rows[0]`, and show an empty state with `ng-if="!rows || rows.length === 0"`.
- **Format numbers and dates:** `{{ total | number:0 }}` (de-ch thousands separator with `flg=de-ch`) and `{{ latest[0].datum | moment:'MMM YYYY' }}`.
- AngularJS core directives (`ng-if`, `ng-show`, `ng-repeat`, `ng-class`, `ng-init` for constant lists) are allowed. Platform filters are not: `currentLanguage` is banned.

## Side effects: exactly two forms

An assignment inside an interpolation, `{{ …; '' }}`, is a side effect. Exactly two forms are allowed. Anything else is a lint error (`side-effect`).

**Guarded default.** It writes only when the parameter is empty. The reader can override it, and clearing the dropdown restores the default.

```html
<span hidden>{{ datactx.parameters['refine.jahr'] = datactx.parameters['refine.jahr'] || latest[0].jahr; '' }}</span>
```

**One-way copy.** It copies one filter to another context, renamed if needed.

```html
<span hidden>{{ geoctx.parameters['refine.year'] = datactx.parameters['refine.jahr']; '' }}</span>
```

Rules the verifier enforces:

- The target is `<ctx>.parameters['…']`, never a plain scope variable (scope rule) and never `$root`.
- The guarded default reads the **same** parameter before `||`. The copy reads a parameter of a **different** context.
- The interpolation sits in the text of a hidden element (`hidden`, or `style="display: none"`), never in an attribute.
- Copies go one way. A copy back from the target context is an error, and so is copying one target parameter from two source contexts.
- Only the guarded default's fallback (after `||`) may be any expression, e.g. `(latest[0].datum | moment:'YYYY')`. Some writes are deliberately **outside** the forms:
  - an unguarded write such as `ctx.parameters['refine.jahr'] = (x | moment:'YYYY')`;
  - a copy that transforms the value;
  - a conditional such as `cond ? (a = b) : ''`.

  Use the guarded default, or put the value in the context's initial parameters (Pattern 3A).
- `ng-init` is only for constant lists, and `ng-click` only for a toggle (`x = !x`). Neither is a way around these forms. The lint checks only `{{ }}`, so this one is up to you.

## Chart colour grammar

`color` on `ods-chart-serie` accepts (`colors.js:64-103`):

- a hex or CSS colour: `color="#2D2D8A"`;
- a JSON array string, e.g. `color='["#2D2D8A","#E69F00"]'` or an interpolated array, used for series from `series-breakdown`;
- `range-<ColorBrewer name>` (`range-Set2`, …), `custom-…` and `single-…`. Don't use them: they are not CI colours;
- `range-custom`, which is banned. It resolves to nothing without the portal's `chartColors` (`highcharts.js:2405-2408`).

With no colour at all, the default is ColorBrewer `Set2` (`colors.js:44`).

Exact value-to-colour maps:

- **Charts:** `category-colors="{'Kultur': '#2D2D8A', 'Sport': '#E69F00'}"` on `ods-chart-query`. It is evaluated as an expression (`highcharts.js:2194,2233`) and keyed by the x value, or by the breakdown value with `series-breakdown` (`highcharts.js:639,1382`).
- **Maps:** `color-categories` + `color-by-field` on `ods-map-layer display="categories"`, plus `color-categories-other` for shapes without data (`map.js:1445-1452`). A choropleth feeds them from `ods-color-gradient`: `color-categories="colors['colors']"`, with `ods-color-gradient-low="#E7E7F2"` and `ods-color-gradient-high="#2D2D8A"`. Choose the exponent per dataset.
- Keys must be **exactly** the field's real values; a missing key silently falls back to the default palette. The dry-run stage checks this.

CI order for categories: `#2D2D8A, #E69F00, #009E73, #56B4E9, #CC79A7, #0072B2, #D55E00`. Use `#6B6B6B` for "Übrige/Andere", and group more than 7 categories into "Übrige". Red is never a category colour. Status colours are for real ratings only.

## Highcharts 6.1.4

data.gr.ch serves **Highcharts 6.1.4** (2018), not the 11.1.0 that ods-widgets 2.1.2 references.

- The Widget attribute syntax is unaffected.
- Anything Highcharts itself draws (defaults, styling, options added after v6) follows 6.1.4. Don't rely on Highcharts docs for v7 or later.
- All `chart-type` values ods-widgets offers are covered by the served modules (core, more, treemap, funnel).

## Maps

- Every `ods-map` carries `scroll-wheel-zoom="false"`, so the map never traps the reader's scrolling on the Host Page (`map.js:328`; lint rule `required-widget-attribute`).
- Join data to boundaries by hand: `ods-color-gradient`, then `color-categories` + `color-by-field`. Never use the native join.
- Boundaries come only from the Boundary Dataset catalogue on data.gr.ch.

## Banned habits

The verifier reports each habit as error `banned-<id>`. Its matchers live in `banned-habits.json`.

| id | Habit | Use instead |
|---|---|---|
| `ods-tabs` | `<ods-tabs>`: a platform-only directive | `ods-simple-tabs` with `ods-simple-tab` |
| `hand-built-tabs` | Tabs built with `ng-click="tab = 'a'"` plus `ng-if`/`ng-show` | `ods-simple-tabs` (Pattern 8) |
| `ods-box` | the `.ods-box` class (platform CSS) in HTML or CSS | the CI base stylesheet's card classes |
| `svelte-class` | copied `svelte-*` classes | the CI base stylesheet's classes |
| `bootstrap-grid` | `container`, `row`, `col-*` (platform Bootstrap grid) | the CI base stylesheet's layout shapes |
| `current-language` | the platform filter `currentLanguage` | German text only |
| `root-shared` | `$root.shared` to pass state around | context parameters; the one-way copy |
| `range-custom` | `color="range-custom"` | CI colours as hex or a JSON array; `category-colors` |
| `q-filter` | `'q': …` in context parameters as a filter | `refine.*` / `exclude.*`, or `ods-adv-analysis-where` |
| `hard-coded-year` | a literal year in parameters, `-where` or expressions | the latest period from the data (Pattern 3) |
| `results-repeat-without-max` | `ng-repeat` over `ods-results` without `ods-results-max` (stops at 10 rows) | an explicit `ods-results-max`, or `ods-table` |
| `native-join` | `join-context` on a map layer (with `local-key` / `remote-key`) | the join by hand (Pattern 9), keys cast with `''+` |
| `domain-attribute` | any `*-domain` attribute (another portal) | data.gr.ch datasets; the Boundary Dataset catalogue |
| `viewport-height` | `100vh` or any `vh` height, in CSS or `style` | fixed px heights from `--target-height` via `calc()` |
| `auto-resize` | `auto-resize` / `ods-auto-resize` | a parent with a fixed px height from `--target-height` |

`hard-coded-year` treats any number from 1900 to 2099 in `*-parameters`, `-where` or `ng-init` as a year. A threshold such as `anzahl >= 2000` in `ods-adv-analysis-where` is reported too. Avoid such thresholds. If one is truly needed, report the false positive to the owner instead of working around the lint.

Lint is the only check for platform-only CSS: the render harness loads the portal's `front-angular.css`, so `.ods-box` and the Bootstrap grid would look fine there.
