# Widget family: chart

Widgets: `ods-chart` > `ods-chart-query` > `ods-chart-serie`. They only work nested in that order, so they share this file.

Parameter tables were generated once from the ngdoc in the ods-widgets **source** (2.1.2, `ods-widgets/src/directives/`, never the stale `docs/` build) and are now maintained by hand. The verifier reads the first column of every table under a `## `ods-…`` heading: an attribute on a listed Widget that appears in none of its tables is reported as warning `undocumented-widget-attribute` (it never fails a Page). A parameter verified in the source but missing from the ngdoc goes into that Widget's "Real but undocumented" table, with its source line, and then stops warning. `<context>` and `<variablename>` in an attribute name stand for any name.

## `ods-chart`

Element or attribute (`src/directives/highcharts.js:1896`). ngdoc: `src/directives/highcharts.js:1899`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `timescale` | string | `none` | Works only with timeseries. If it defines the default timescale to use to display the X-axis. It does not affect how the different series are requested (they have their own timescale) but enforces X-axis intervals. | 1902 |
| `label-x` | string | `none` | If set, it overrides the default X-axis label. The default label is generated from the series. | 1903 |
| `single-y-axis` | boolean | `false` | Enforces the use of only one Y-axis for all series. In this case, specific Y-axis parameters defined for each series will be ignored. | 1904 |
| `single-y-axis-label` | string |  | Sets the label for the single Y-axis. | 1905 |
| `min` | integer | `null` | Sets the min displayed value for Y-axis. Active only when singleYAxis is true. | 1906 |
| `max` | integer | `null` | Sets the max displayed value for Y-axis. Active only when singleYAxis is true. | 1907 |
| `step` | integer | `null` | Specifies the step between each tick on the Y axis. If not defined, it is computed automatically. Active only when singleYAxis is true. | 1908 |
| `scientific-display` | boolean | `true` | When set to false, force the full display of the numbers on the Y-axis. Active only when singleYAxis is true. | 1909 |
| `logarithmic` | boolean | `false` | Uses a logarithmic scale for Y-axis. Active only when singleYAxis is true. | 1910 |
| `display-legend` | boolean | `true` | Enables or disables the display of series legend. Active only when singleYAxis is true. | 1911 |
| `align-month` | boolean | `true` | Aligns the month values with the month label. The old behavior aligns values with the middle of the month. Setting this parameter to false reverts to the old behavior. | 1912 |
| `labels-x-length` | integer | `12` | Sets the maximum number of characters displayed for the X-axis labels. | 1913 |

## `ods-chart-query`

Element (`src/directives/highcharts.js:2181`). ngdoc: `src/directives/highcharts.js:2184`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `field-x` | string |  | Sets the field that is used to compute the aggregations during the analysis query. | 2187 |
| `timescale` | string | `"year"` | Works only with timeseries (when fieldX is a date or datetime). Y values will be computed against this interval. For example, if you have daily values in a dataset and ask for a "month" timescale, the Y values for the series inside this query will aggregated month by month and computed. | 2188 |
| `maxpoints` | integer | `50` | Defines the maximum number of points fetched by the query. With a value of 0, all points will be fetched by the query. | 2189 |
| `stacked` | string | `null` | Stacks the resulting charts. Stacked values can 'normal' or 'percent'. Only works with columns, bar, line, spline, area, and spline area charts. | 2190 |
| `reverse-stacks` | boolean | `false` | Reverses the order of the displayed stack. Only works with stacked charts when the singleYAxis option is not active on the chart. | 2191 |
| `series-breakdown` | string | `none` | When declared, all series are broken down by the defined facet. | 2192 |
| `series-breakdown-timescale` | string | `true` | If the breakdown facet is a time serie (date or datetime), it defines the aggregation level for this facet. | 2193 |
| `category-colors` | object | `{}` | A object containing a color for each category name. For example: {'my value': '#FF0000', 'my other value': '#0000FF'} | 2194 |
| `sort` | string | `none` | Displays the results in a specific order. The following values are available: - To sort based on horizontal axis, use `x` or `-x`. For date-based axes, you need to include the name of the field, and the highest precision in the displayed data. For example, if the field name is `mydate`, and the data includes the year, … | 2195 |

Real but undocumented (read in the source, absent from the ngdoc; no lint warning):

| Attribute | Type | Description | Source |
|---|---|---|---|
| `context` | string | Name of the Dataset Context the query reads. Required: the source calls `attrs.context.trim()` without a guard. | highcharts.js:2272 |

## `ods-chart-serie`

Element (`src/directives/highcharts.js:2314`). ngdoc: `src/directives/highcharts.js:2317`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `chart-type` | string | `none` | Available types are: 'line', 'spline', 'arearange', 'areasplinerange', 'columnrange', 'area', 'areaspline', 'column', 'bar', 'pie', 'scatter' | 2320 |
| `function-y` | string | `none` | Sets up the function that will be used to calculate aggregation value. 'COUNT' counts the number of documents for each category defined by expressionY. | 2321 |
| `expression-y` | string | `none` | Sets up the facet used for aggregation | 2322 |
| `color` | string | `none` | Defines the color used for this serie. see colors below | 2323 |
| `label-y` | string | `none` | Specifies a custom label for the series | 2324 |
| `labelsposition` | string | `'outside'` | Specifies the position of labels. The authorized values are 'inside' or 'outside' (for pie charts only). | 2325 |
| `innersize` | number | `0` | This parameter can be used to change a pie chart into a donut by creating a hole in the center. The value is expressed in pixels. | 2326 |
| `cumulative` | boolean | `none` | Y values are accumulated | 2327 |
| `logarithmic` | boolean | `false` | Displays the serie using a logarithmic scale | 2328 |
| `min` | integer | `null` | Minimum value to be displayed on the Y-axis. If not defined, it is computed automatically. | 2329 |
| `max` | integer | `null` | Maximum value to be displayed on the Y axis. If not defined, it is computed automatically. | 2330 |
| `step` | integer | `null` | Specifies the step between each tick on the Y-axis. If not defined, it is computed automatically. | 2331 |
| `index` | integer | `null` | Forces the display order of the serie. The higher is on top, the lower is below (starts from 1). | 2332 |
| `scientific-display` | boolean | `true` | When set to false, force the full display of the numbers on the Y-axis. | 2333 |
| `display-units` | boolean | `none` | Enables the display of the units defined for the field in the tooltip | 2334 |
| `display-values` | boolean | `none` | Enables the display of each invidual values in stacks | 2335 |
| `display-stack-values` | boolean | `none` | Enables the display of the cumulated values on top of stacks | 2336 |
| `multiplier` | number | `none` | Multiplies all values for this serie by the defined number | 2337 |
| `color-thresholds` | string | `none` | An array of (value, color) objects. For each threshold value, if the Y value is above the threshold, the defined color is used. The format for this parameter is color-thresholds="[{'value': 5, 'color': '#00ff00'},{'value': 10, 'color': '#ffff00'}]" | 2338 |
| `subsets` | string | `none` | Used when functionY is set to 'QUANTILES' to define the wanted quantile | 2339 |
| `subseries` | boolean | `none` | An array of subseries. They are used for range, columnrange, and boxplot charts. Each item of the array contains an object like: {"func": "AVG", "yAxis": "myfield"} | 2340 |
| `refine-on-click-context` | string | `none` | Context name or array of contexts name on which to refine when the series is clicked on. It won't work properly if the fieldX attribute of the parent odsChartQuery is a date or datetime field and if the associated timescale is not one of 'year', 'month', 'day', 'hour', 'minute'. | 2341 |
| `refine-on-click-<context>-context-field` | string | `none` | Name of the field that will be refined for each context | 2342 |

## Correct usage

Every claim cites `ods-widgets/src/directives/<file>:<line>`; re-check them after a Huwise upgrade. All chart citations are in `highcharts.js`.

**`ods-chart`**

- The tag is replaced by `div.odswidget.odswidget-charts` (`replace: true`, `highcharts.js:2003-2005`). Size and style that root in the Page's CSS.
- Contradiction: the ngdoc says restrict `E`; the source allows `EA` (`highcharts.js:1973`). The Page rules use the element.
- Boolean-looking attributes are compared as **strings**, so the written value matters:
  - `single-y-axis` is `!!$scope.singleYAxis` (`highcharts.js:2020`), so `single-y-axis="false"` is **true**. Leave the attribute off to get one axis per series.
  - `logarithmic` is truthy for any non-empty string, `"false"` included (`highcharts.js:2022`).
  - `display-legend` is off only for the exact string `"false"` (`highcharts.js:2027`); `scientific-display` is on unless it is the exact string `"false"` (`highcharts.js:2026`).
- `single-y-axis-scale` is bound by the scope (`highcharts.js:1979`) but never read; `logarithmic` is what sets the scale (`highcharts.js:2022`).
- `ods-chart` also binds an old one-element syntax (`context`, `field-x`, `expression-y`, `function-y`, `chart-type`, `color`, `chart-config`, `label-y`, `sort`, `maxpoints`, `parameters`; `highcharts.js:1974-2001`). None of these are in the ngdoc table. With `context` on `ods-chart`, a nested `ods-chart-query` only logs "cannot use ods-chart-query when context and chartConfig are declared" (`highcharts.js:2042,2110`). Pages always use the nested form, so these attributes get the undocumented-attribute warning.

**`ods-chart-query`**

- Contradiction: `context` is read (`attrs.context.trim()`, `highcharts.js:2272`) but the ngdoc does not document it. It is required: without it the Widget throws. The name is looked up with `scope[context]`, so the context must be visible from the element.
- It needs an `ods-chart` ancestor (`require: ^odsChart`, `highcharts.js:2211`) and registers its series as they link.
- `sort` is `y` or `-y` (turned into `serie1`/`-serie1`, `highcharts.js:2237-2243`) or a field name.
- `category-colors` is evaluated as an expression (`scope.$eval`, `highcharts.js:2233`); `reverse-stacks` must be the string `true` (`highcharts.js:2230`).
- Every attribute is watched deeply and the chart refreshes when one changes (`highcharts.js:2291-2300`); so is `<context>.parameters` (`highcharts.js:2289-2291`).
- `attrs.options` is merged into the request (`highcharts.js:2248,2278,2291`) but it is a raw attribute string and not documented; don't use it.

**`ods-chart-serie`**

- Contradiction: the ngdoc gives `scientific-display` the default `true`; the source reads `attrs.scientificDisplay === "true"`, so the default is **false** here (`highcharts.js:2400`). The chart-level attribute defaults to true (`highcharts.js:2026`).
- `cumulative` and `logarithmic` are truthy for any non-empty string (`highcharts.js:2392-2393`), so `cumulative="false"` still accumulates. Leave the attribute off. `display-units`, `display-values` and `display-stack-values` need the exact string `true` (`highcharts.js:2394-2396`).
- `chart-type`, `inner-size`, `function-y`, `expression-y`, `label-y`, `min`, `max`, `step`, `multiplier`, `color` and `color-thresholds` are dynamic: changing them re-renders the series (`highcharts.js:2387,2439-2454`). `index`, `subsets` and `subseries` are read once (`highcharts.js:2391,2397-2398`).
- `subseries` goes through `JSON.parse` (`highcharts.js:2398`); invalid JSON throws at link time.
- `color-thresholds` is evaluated as an expression (`highcharts.js:2423`).
- `color="range-custom"` resolves to no colour without the portal's `chartColors` (`highcharts.js:2405-2408`); that is why the lint bans it (core.md, "Chart colour grammar").
- `refine-on-click-*` needs the refine-on-click directive on the same element (`require: ?refineOnClick, ?refineOnClickContext`, `highcharts.js:2380`). Pages don't use it.
