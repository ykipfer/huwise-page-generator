# Widget family: data

Widgets: `ods-results`, `ods-facet-results`, `ods-adv-analysis`, `ods-aggregation` (attribute Widgets that expose a variable) and `ods-table`, `ods-gauge` (elements). Read `core.md` first (scope rule, v1 vs ODSQL).

Parameter tables were generated once from the ngdoc in the ods-widgets **source** (2.1.2, `ods-widgets/src/directives/`, never the stale `docs/` build) and are now maintained by hand. The verifier reads the first column of every table under a `## `ods-…`` heading: an attribute on a listed Widget that appears in none of its tables is reported as warning `undocumented-widget-attribute` (it never fails a Page). A parameter verified in the source but missing from the ngdoc goes into that Widget's "Real but undocumented" table, with its source line, and then stops warning. `<context>` and `<variablename>` in an attribute name stand for any name.

## `ods-results`

Attribute (`src/directives/results.js:6`). ngdoc: `src/directives/results.js:9`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `ods-results` | string | `results` | Variable name to use | 12 |
| `ods-results-context` | CatalogContext\|DatasetContext |  | Catalog Context or Dataset Context to use | 13 |
| `ods-results-max` | number | `10` | Maximum number of results to show. The value can be changed dynamically using a variable. | 14 |

## `ods-facet-results`

Attribute (`src/directives/facet-results.js:6`). ngdoc: `src/directives/facet-results.js:9`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `ods-facet-results` | string | `results` | Variable name to use | 12 |
| `ods-facet-results-context` | CatalogContext\|DatasetContext |  | Catalog Context or Dataset Context to use | 13 |
| `ods-facet-results-facet-name` | string |  | Name of the facet to enumerate | 14 |
| `ods-facet-results-sort` | string | `count` | Sorting method used on categories: - `count` or `-count` to sort by number of items in each category - `num` or `-num` to sort by the name of category, if it is a number - `alphanum` or `-alphanum` to sort by the name of the category Note: the `-` character before the name of the sorting method indicates that values … | 15 |

## `ods-adv-analysis`

Attribute (`src/directives/advanced-analysis.js:19`). ngdoc: `src/directives/advanced-analysis.js:22`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `ods-adv-analysis` | string |  | This name can be used as the `data` attribute of the display widgets that support it (e.g. `odsAdvTable`). | 25 |
| `ods-adv-analysis-context` | string |  | Insert here the name of the context to use. | 26 |
| `ods-adv-analysis-select` | string | `none` | Type here the query to make. More use cases are available below. The documentation about the ODSQL select clause is available here. This clause will contain the values (i.e., the y-axis in case of a chart). | 27 |
| `ods-adv-analysis-where` | string | `none` | This parameter allows to filter rows with a combination of expressions. The documentation about the ODSQL `where` clause is available [here](https://help.huwise.com/apis/ods-explore-v2/#section/Opendatasoft-Query-Language-%28ODSQL%29/Where-clause). | 28 |
| `ods-adv-analysis-group-by` | string | `none` | This parameter helps regroup the calculation according to specific criteria. The `group-by` in this clause can become either y-axis or series in a chart. The documentation about the ODSQL `GROUP BY` clause is available … | 29 |
| `ods-adv-analysis-order-by` | string | `none` | This parameter is used to sort the results of an aggregation using the `ASC` and `DESC` keywords (e.g., `myField ASC` or ). The documentation about the ODSQL `ORDER BY` clause is available [here](https://help.huwise.com/apis/ods-explore-v2/#section/Opendatasoft-Query-Language-%28ODSQL%29/Order-by-clause). | 30 |
| `ods-adv-analysis-limit` | string | `none` | Limits the number of items to return. | 31 |

## `ods-aggregation`

Attribute (`src/directives/aggregation.js:6`). ngdoc: `src/directives/aggregation.js:9`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `ods-aggregation` | string | `aggregation` | (mandatory) Name of the variable that holds the result of the aggregation. For multiple aggregations, variable names must be separated with commas. | 12 |
| `ods-aggregation-context` | DatasetContext |  | (mandatory) Dataset Context to use. | 13 |
| `ods-aggregation-<variablename>-context` | DatasetContext |  | Context specific to the [Variablename] aggregation. `[Variablename]` must be replaced with the name of the variable, declared through the **odsAggregation** parameter. | 14 |
| `ods-aggregation-function` | string | `COUNT` | (mandatory) Aggregation function to apply: - AVG: average - COUNT - MIN: minimum - MAX: maximum - STDDEV: standard deviation - SUM | 15 |
| `ods-aggregation-<variablename>-function` | string | `COUNT` | Function specific to the [Variablename] aggregation. `[Variablename]` must be replaced with the name of the variable, declared through the **odsAggregation** parameter. | 24 |
| `ods-aggregation-expression` | string | `none` | (optional only with the COUNT function) Expression to apply the function on (e.g., the name of a field). | 25 |
| `ods-aggregation-<variablename>-expression` | string | `none` | Expression specific to the [Variablename] aggregation. `[Variablename]` must be replaced with the name of the variable, declared through the **odsAggregation** parameter. | 26 |

## `ods-table`

Element (`src/directives/table.js:6`). ngdoc: `src/directives/table.js:9`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `context` | DatasetContext |  | Dataset Context to use | 12 |
| `displayed-fields` | string | `all` | A comma-separated list of fields to display. By default, all the available fields are displayed. | 13 |

Real but undocumented (read in the source, absent from the ngdoc; no lint warning):

| Attribute | Type | Description | Source |
|---|---|---|---|
| `sort` | string | Initial sort, `field` or `-field`. Bound by the scope, absent from the ngdoc. | table.js:33 |

## `ods-gauge`

Element (`src/directives/gauge.js:6`). ngdoc: `src/directives/gauge.js:9`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `display-mode` | string | `circle` | Type of chart: 'circle' or 'bar' | 12 |
| `max` | float | `100` | The maximum value for the gauge | 13 |
| `value` | float |  | A number between 0 and the defined `max` value | 14 |

## Correct usage

Every claim cites `ods-widgets/src/directives/<file>:<line>`; re-check them after a Huwise upgrade.

**`ods-results`**

- The variable is the array of records (`$scope[variable] = data.records`, `results.js:91`); each row is `row.fields.<name>`.
- Without `ods-results-max` only 10 rows are requested (ngdoc default; `rows: $attrs.odsResultsMax` goes straight to the API, `results.js:72`). Every `ng-repeat` over it therefore needs an explicit `ods-results-max` (lint: `banned-results-repeat-without-max`).
- It has `scope: true` and `priority: 1001` so a sibling `ng-repeat` on the same element finds the variable (`results.js:64-65`). Put the `ng-repeat` on the same element or inside it.
- `context.nhits` is set to the total hit count, independent of the max (`results.js:92`).

**`ods-facet-results`**

- The variable is the facet's value array `[{name, path, state, count}]` (`facet-results.js:87`). `scope: true`, `priority: 1001` (`facet-results.js:54-55`).
- The default variable is `results` when the attribute has no value (`facet-results.js:70`).
- Contradiction: for a response that has facet groups but none named `ods-facet-results-facet-name`, the source sets `[]` and then reads `facetGroup[0].facets` anyway (`facet-results.js:82-87`), which throws. A mistyped facet name therefore shows up as a console error, not an empty list.
- It re-runs whenever the context object changes (deep watch, `facet-results.js:60,94`), so a filter on the same context changes its own options. Use a second context when the options must not follow the filter (core.md, "Contexts").

**`ods-adv-analysis`**

- The variable is the bare result array (`$scope[variableName] = results`, `advanced-analysis.js:156`). Contradiction: the ngdoc reads it as `{{myData.results[X]}}` (`advanced-analysis.js:44`); use `latest[0].total`.
- Without `ods-adv-analysis-group-by` the limit is forced to 1 (`advanced-analysis.js:136`). With a group-by, set `-limit` explicitly.
- With a group-by, rows whose group value is `null` are dropped (`advanced-analysis.js:150-154`).
- The context's v1 parameters are converted to v2.1 and the widget's own `-where` is ANDed with the converted one (`advanced-analysis.js:123-130`).
- It reads `$scope[contextName]` directly (`advanced-analysis.js:172,183`), so the context name must resolve in scope, i.e. the Widget sits inside the context element.
- `scope: true` (`advanced-analysis.js:118`).

**`ods-aggregation`**

- The variable is a plain number (`$scope[aggregationName] = data[0].serie1`, `aggregation.js:126`), or `null` when there are no rows (`aggregation.js:128`). Contradiction: the ngdoc says `-expression` is required except for `COUNT`; the source never checks it.
- One element can compute several values: `ods-aggregation="a, b"` with `ods-aggregation-a-function`, `-a-expression`, `-a-context`. A named attribute wins over the generic one (`aggregation.js:97-100`).
- The function defaults to `COUNT` (`aggregation.js:107`). It uses the v1 analyze API with the context's parameters (`aggregation.js:118-122`).
- `scope: true` (`aggregation.js:92`): the number is visible only inside the element.

**`ods-table`**

- The tag is replaced by `div.odswidget.odswidget-table` (`replace: true`, `table.js:37,40`). The Page's CSS targets that class, not `ods-table`.
- Contradiction: the ngdoc lists `context` and `displayed-fields` only; the scope also binds `sort` and `dataset-feedback` (`table.js:31-35`).
- The default stylesheet gives `.odswidget-table` `height: 400px; overflow: hidden` (`less/components/table.less:1-5`). The body height is computed once from the element's height (`table.js:681-688`), so give the table a fixed pixel height in the Page's CSS; it scrolls inside that box.
- It loads 40 rows per page and scrolls infinitely (`table.js:67,108`).

**`ods-gauge`**

- The tag is replaced by `div.odswidget-gauge` (`gauge.js:40,64`). The percentage text is always rendered (`gauge.js:65`).
- Contradiction: the ngdoc offers `circle` and `bar`; the source also accepts `horizontal` (`gauge.js:33`) but draws the bar only for `bar` (`gauge.js:49`), so `horizontal` renders the circle SVG with a horizontal class. Use `circle` or `bar`.
- `display-mode` is read when the template is built, before interpolation (`gauge.js:46-50`): write a literal. `value` and `max` are expressions (`=`, `gauge.js:41-45`), so `value="42"` and `value="total"` both work; `{{ }}` does not.
- The height follows the width; forcing a height in CSS does nothing (ngdoc, `gauge.js:19-21`).
