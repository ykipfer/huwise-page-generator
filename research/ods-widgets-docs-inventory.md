# What the ods-widgets docs and source say about each Widget

Research for [#2](https://github.com/ykipfer/huwise_page_generator/issues/2) (map [#1](https://github.com/ykipfer/huwise_page_generator/issues/1)). Researched 2026-10-16 against the owner's local, gitignored checkouts:

- `ods-widgets/` is the library. Its `CHANGELOG.md` tops out at **2.1.2 (2025-07-21)**. `package.json` says `0.0.0`, so the CHANGELOG is the only version marker.
- `page_examples/` holds 8 Example Pages (`index.html` + `stylesheet.css` each).

Paths below are relative to the repo root of the owner's checkout. Line numbers refer to the files as they were on that date.

## Answer in brief

- **The ngdoc comments in `ods-widgets/src/` are the only usable documentation.**
  - `src-docs/` holds five short hand-written overview pages (reading a reference page, contexts, filters). It has no per-Widget content.
  - `samples/index.html` is one 56-line page that uses the deprecated `ods-highcharts`.
  - `docs/` is an **old, stale build**: `docs/partials/api` lacks 15 documented directives and 5 filters. Among the missing are `odsSelect`, `odsLegend`, `odsSimpleTabs`/`odsSimpleTab` and `odsAdvAnalysis`, which do most of the work in the Example Pages.
- **Coverage:** 88 directives are registered and 67 have an ngdoc block (the Widgets). Of the 46 registered filters, 34 are documented.
  - Parameter tables exist for nearly every Widget: 354 `@param` rows in total.
  - 51 of the 67 Widgets have an `@example`, and 2 more show code inline in the description.
  - Accepted values are documented well for enum-like parameters (map `display` modes, chart types, aggregation functions, facet sort). They are missing for colors and for most output shapes.
  - Of the 34 documented filters, 29 have no description beyond the `@param` lines.
- **Docs and source disagree in places that matter for the Widgets the Example Pages use.** See [Verified disagreements](#verified-disagreements-and-silences). Examples:
  - The documented `odsAdvAnalysis` output shape is wrong.
  - The default variable name for `odsAnalysis` is wrong.
  - The default for `odsChartSerie scientific-display` is inverted.
  - The chart `color` syntax isn't documented.
  - `odsChartQuery context` is mandatory but isn't documented.
- **The Example Pages depend on things ods-widgets doesn't provide:**
  - the `currentLanguage` filter and the `ods-box` CSS class, which come from the Huwise platform;
  - AngularJS core (`ng-if`, `ng-repeat`, `ng-init`, and the `number`, `date` and `filter` filters);
  - expression idioms the docs never mention.

  They also contain at least one attribute the library ignores (`stroke-width` on `ods-chart-serie`).
- **Verdict:** a parameter-table reference **can be generated mechanically**. The extractor for this research was about 60 lines of Python. The **correctness layer has to be written by hand**: the disagreements, the silent idioms, platform-only features, and nesting/scope rules.
- **Size:** the full raw ngdoc for all 67 Widgets is about 155k characters, roughly **39–44k tokens**. For the 19 Widgets the Example Pages use it is about 78k characters, roughly **20–22k tokens**. A compact reference without examples or prose, plus a hand-written gotchas section, should fit in about **8–12k tokens** for those 19 Widgets. That last figure is an estimate; it has not been measured.

## Sources and their state

| Source | What it contains | Usable? |
|---|---|---|
| `ods-widgets/src/directives/*.js`, `src/filters.js`, `src/services/*.js` | ngdoc blocks (`@ngdoc`, `@name`, `@param`, `@description`, `@example`), plus the code itself | **Yes. This is the source of truth.** |
| `ods-widgets/src-docs/getting-started/*.ngdoc` (4 files) and `src-docs/widgets/index.ngdoc` | Overview prose: how to read a reference page (parameter names are camelCase in the table, kebab-case in HTML), the context concept (Widgets that *act on* versus *are based on* a context), filters (`{{ v \| filter:arg }}`). The examples are embedded CodePens, so the content isn't in the repo. | Background only |
| `ods-widgets/docs/` | A generated HTML build: `index.html` plus 88 partials in `docs/partials/api/` | **No. It's stale** (see below) |
| `ods-widgets/samples/index.html` | One demo page: catalog and dataset contexts, `ods-highcharts`, `ods-map`, `ods-table`, feeds | No. It uses the deprecated Widget |
| `ods-widgets/README_docs.md` | How the docs are built: `grunt ngdocs` on Node 8.17 | Explains why `docs/` is stale |
| Hosted docs at help.huwise.com/widgets | Not checked: this research was offline and limited to local sources | Unknown |

**`docs/` is stale.** Comparing the ngdoc names in `src/` with `docs/partials/api/*.html`:

- **Documented in `src/` but missing from `docs/`:** `odsAdvAnalysis`, `odsAdvTable`, `odsColorGradient`, `odsDateRangeSlider`, `odsGeoNavigation`, `odsGetElementLayout`, `odsGetWindowLayout`, `odsLegend`, `odsMapLayer`, `odsMapLayerGroup`, `odsPopIn`, `odsSelect`, `odsSimpleTab`, `odsSimpleTabs`, `odsTimer`, and the filters `fromjson`, `math`, `momentadd`, `uriComponentEncode`, `uriEncode`.
- **In `docs/` but not in `src/`:** `filter.momentAdd` (renamed to `momentadd`).

## Inventory: registered directives versus documented Widgets

`src/` registers **88 directives** with `.directive('name', …)`. **67 of them** have an `@ngdoc directive` block. These 67 are the Widgets a user is meant to write.

The 21 registered directives without an ngdoc block fall into three groups:

| Group | Directives | Notes |
|---|---|---|
| Internal helpers and sub-controls | `inject`, `odsFullClick` (`utils.js`); `odsCalendarTooltip`; `odsFacet`, `odsFacetCategory`, `odsFacetCategoryList` (children of `odsFacets`, which documents their attributes in its own `@param` list); `odsMapDisplayControl`, `odsMapLegend`, `odsMapSearchBox`, `odsMapTooltip`, `odsMapPicto`; `odsHighchartsChart`; `odsAnalysisSerie`; `refineOnClickContext`; `autoResize` (an alias of `odsAutoResize`) | Not meant to be written by hand, except the `odsFacet` children |
| Legacy | `odsHighcharts` and `odsMultiHighcharts` (`highcharts.js:1679,1833`: they have `@name` and `@param` but **no `@ngdoc` tag**, so they are hidden from the docs), `odsMapLegacy`, `odsAnalyze` | Superseded by `odsChart` and `odsMap` |
| Public but undocumented | `odsAdvResults` (`advanced-results.js`: `select`/`where`/`orderBy`/`rows`, an API v2 sibling of `odsResults`), `odsTwitterTimeline` | Usable, but you'd have to read the source |

### Per-Widget table (all 67 documented Widgets)

How to read the columns:

- **restrict:** `E` means element, `A` means attribute. It's the doc's value; a different source value is shown as "/ src X", and "src -" means the source doesn't set it (AngularJS defaults to `EA`).
- **params:** the number of `@param` rows.
- **unbracketed:** params not written as `[optional]`. ngdoc marks mandatory parameters inconsistently, so treat this as indicative only.
- **example:** `yes` means an `@example` block, `inline` means `<pre>` code in the description, `no` means neither.
- **require:** the directive's `require:` from the source, which encodes nesting rules (`^X` means it must sit inside X; `?` means X is optional).
- **Example Page use:** occurrences across the 8 pages.

| Widget | file (`src/directives/`) | restrict | params | unbracketed | example | require (nesting) | Example Page use |
|---|---|---|---|---|---|---|---|
| odsAdvAnalysis | `advanced-analysis.js` | A | 7 | 2 | inline | - | 9 (2 pages) |
| odsAdvTable | `advanced-table.js` | E | 7 | 1 | yes | - | - |
| odsAggregation | `aggregation.js` | A | 7 | 2 | yes | - | 2 (1 page) |
| odsAnalysis | `analysis.js` | A | 6 | 1 | yes | - | 3 (2 pages) |
| odsAutoResize | `auto-resize.js` | A / src - | 0 | 0 | yes | - | - |
| odsCalendar | `calendar.js` | E | 9 | 4 | yes | ?refineOnClick | - |
| odsCatalogContext | `catalog-context.js` | AE | 5 | 1 | yes | - | - |
| odsChart | `highcharts.js` | E / src EA | 12 | 1 | inline | - | 5 (4 pages) |
| odsChartQuery | `highcharts.js` | E | 9 | 1 | no | ^odsChart | 6 (4 pages) |
| odsChartSerie | `highcharts.js` | E | 23 | 0 | no | ^odsChartQuery, ?refineOnClick | 6 (4 pages) |
| odsClearAllFilters | `clear-all-filters.js` | E | 2 | 2 | no | - | - |
| odsColorGradient | `analysis.js` | A | 8 | 4 | yes | - | 2 (2 pages) |
| odsCrossTable | `cross-table.js` | E | 9 | 6 | yes | - | - |
| odsDatasetContext | `dataset-context.js` | AE | 9 | 2 | yes | - | 15 (8 pages) |
| odsDatasetSchema | `dataset-schema.js` | E | 1 | 1 | yes | - | - |
| odsDateRangeSlider | `date-range-slider.js` | E | 11 | 1 | yes | - | - |
| odsDatetime | `datetime.js` | A | 0 | 0 | yes | - | - |
| odsDisqus | `disqus.js` | E | 2 | 1 | no | - | - |
| odsDomainStatistics | `domain-statistics.js` | AE | 1 | 1 | yes | - | - |
| odsFacetResults | `facet-results.js` | A | 4 | 2 | yes | - | 16 (5 pages) |
| odsFacets | `facets.js` | E | 12 | 2 | yes | - (children `^odsFacets`) | - |
| odsFilterSummary | `filter-summary.js` | E | 5 | 1 | no | - | - |
| odsGauge | `gauge.js` | E | 3 | 1 | yes | - | 1 (1 page) |
| odsGeoNavigation | `geo-navigation.js` | E | 5 | 3 | no | - | - |
| odsGeotooltip | `geotooltip.js` | E | 6 | 0 | yes | - | - |
| odsGetElementLayout | `getwidthheight.js` | A | 0 | 0 | yes | - | - |
| odsGetWindowLayout | `getwidthheight.js` | A | 0 | 0 | yes | - | - |
| odsGist | `gist.js` | E | 2 | 2 | yes | - | - |
| odsHubspotForm | `hubspot-form.js` | E | 2 | 2 | yes | - | - |
| odsInfiniteScrollResults | `infinite-scroll-results.js` | A / src - | 7 | 1 | yes | - | - |
| odsLastDatasetsFeed | `last-datasets-feed.js` | E | 1 | 1 | yes | - | - |
| odsLastReusesFeed | `last-reuses-feed.js` | E | 3 | 1 | yes | - | - |
| odsLegend | `legend.js` | E | 6 | 2 | yes | - | 2 (2 pages) |
| odsMap | `map.js` | E / src EA | 19 | 4 | yes | - | 6 (6 pages) |
| odsMapLayer | `map.js` | E / src EA | 43 | 2 | yes | ^odsMap, ?^odsMapLayerGroup | 11 (6 pages) |
| odsMapLayerGroup | `map.js` | E / src EA | 5 | 1 | yes | ^odsMap | - |
| odsMediaGallery | `media-gallery.js` | E | 6 | 1 | yes | ?odsWidgetTooltip, ?odsAutoResize, ?refineOnClick | - |
| odsMostPopularDatasets | `most-popular-datasets.js` | E | 3 | 1 | yes | - | - |
| odsMostUsedThemes | `most-used-themes.js` | E | 1 | 1 | yes | - | - |
| odsPageRefresh | `page-refresh.js` | AE | 1 | 0 | no | - | - |
| odsPaginationBlock | `pagination-block.js` | E | 4 | 1 | no | - | - |
| odsPicto | `picto.js` | E | 5 | 5 | yes | - | - |
| odsPopIn | `pop-in.js` | E / src - | 4 | 1 | yes | - | - |
| odsRecordImage | `record-image.js` | E | 4 | 3 | no | - | - |
| odsResultEnumerator | `result-enumerator.js` | E | 4 | 1 | yes | - | - |
| odsResults | `results.js` | A | 3 | 1 | yes | - | 21 (5 pages) |
| odsReuses | `reuses.js` | E | 1 | 1 | yes | - | - |
| odsSearchbox | `searchbox.js` | E | 5 | 2 | no | - | - |
| odsSelect | `select.js` | E | 9 | 2 | yes | - | 25 (6 pages) |
| odsSimpleTab | `simple-tabs.js` | E | 3 | 2 | no | ^odsSimpleTabs | 10 (4 pages) |
| odsSimpleTabs | `simple-tabs.js` | E | 1 | 0 | no | - | 4 (4 pages) |
| odsSlideshow | `slideshow.js` | E | 4 | 2 | yes | - | - |
| odsSocialButtons | `social-buttons.js` | A / src E | 3 | 0 | yes | - | - |
| odsSpinner | `spinner.js` | E | 0 | 0 | yes | - | - |
| odsSubaggregation | `analysis.js` | A | 2 | 2 | yes | - | - |
| odsTable | `table.js` | E | 2 | 1 | yes | ?odsAutoResize | 2 (2 pages) |
| odsTagCloud | `tag-cloud.js` | E | 5 | 2 | yes | - | - |
| odsTextSearch | `text-search.js` | E | 6 | 3 | yes | - | 1 (1 page) |
| odsThemeBoxes | `theme-boxes.js` | E | 1 | 1 | no | - | - |
| odsThemePicto | `picto.js` | E | 1 | 1 | no | - | - |
| odsTimer | `timer.js` | E | 4 | 0 | yes | - | - |
| odsTimerange | `timerange.js` | E | 13 | 1 | yes | - | - |
| odsTimescale | `timescale.js` | E | 3 | 1 | yes | - | - |
| odsToggleModel | `toggle-model.js` | A | 4 | 3 | yes | - | - |
| odsTopPublishers | `top-publishers.js` | E | 1 | 1 | yes | - | - |
| odsWidgetTooltip | `widget-tooltip.js` | A | 0 | 0 | yes | - | - |
| refineOnClick | `refine-on-click.js` | A / src - | 0 | 0 | yes | - | - |

**Rating each documentation dimension.** "Accepted values" and "disagreements" were checked by hand only for the **19 Widgets the Example Pages use**. For the other 48 Widgets only the counts in the table above are verified.

| Dimension | How well it's documented |
|---|---|
| Attributes | Good. Nearly every attribute has a `@param` row. Dynamic attribute families are written with placeholders (`ods-aggregation-[name]-function`, `ods-analysis-serie-[name]`, `[ctx]-dataset`), which a mechanical extractor has to expand. |
| Accepted values | Mixed. Enums are listed in the param text: map `display`, `border-pattern`, chart types, aggregation functions, facet sort, `stacked`. Colors, output data shapes and boolean defaults are weak; see below. |
| Nesting and context | Partial. "Sub widget" or "can only be used based on odsMap" wording covers chart and map. Only `odsSimpleTab` has `@requires`. **Scope visibility is never stated** (see below). Most data Widgets document `context` as a mandatory param; `odsChartQuery` doesn't. |
| Examples | Good for the common Widgets. All examples use Huwise demo domains (`documentation-resources.huwise.com`, `data.huwise.com`, `hub.huwise.com`), never data.gr.ch. `odsChartQuery`, `odsChartSerie`, `odsSimpleTabs` and `odsSimpleTab` have no example of their own; `odsChart` shows code inline. |
| Filters | Weak. 29 of 34 documented filters consist of only `@param` and `@return` lines. 13 registered filter names have no matching doc block, including `min`, `max`, `filesize`, `formatFieldValue` and `prettyText`. One of the 13 is a naming error: the filter is documented as `imageify` but registered as `imagify` (`filters.js`), so the documented name throws "unknown filter". |

## Verified disagreements and silences

These were all confirmed by reading the source. Heuristic hits that turned out to be parser artifacts (dynamic attribute templates, child-directive delegation, `require`d sibling directives) are excluded.

### Docs contradict the source

1. **The documented `odsAdvAnalysis` output shape is wrong.** The description says to display results via `{{myData.results[X]}}` (`advanced-analysis.js:44`). The code assigns the bare array: `$scope[variableName] = results;` (`advanced-analysis.js:156`). The Example Pages use the correct form, `details[0].gemeinde`.
2. **The default variable name for `odsAnalysis` is wrong.** The docs say `[odsAnalysis=analysis]` (`analysis.js:64`); the code uses `$attrs.odsAnalysis || 'results'` (`analysis.js:135`).
3. **The default for `odsChartSerie scientificDisplay` is inverted.** The docs say `[scientificDisplay=true]` (`highcharts.js:2333`). The code reads `scientificDisplay: attrs.scientificDisplay === "true"` (`highcharts.js:2400`), so the attribute is false when absent. `odsChart` really does default to true (`highcharts.js:2026`). Example Pages set the value explicitly on both.
4. **`odsMap` auto-resize.** The docs name only `odsAutoResize` (`map.js:68`). The source accepts both `auto-resize` (scope binding, `map.js:130`) and `ods-auto-resize` (`map.js:171`). The Example Pages use `auto-resize="true"`, which isn't documented but works.
5. **Filter name:** the docs name it `imageify`; the code registers `imagify`.
6. **Restrict mismatches** (low impact): `odsChart`, `odsMap`, `odsMapLayer` and `odsMapLayerGroup` are documented as `E` but the source declares `EA`. `odsSocialButtons` is documented as `A` but the source declares `E`.

### Docs are silent where the Example Pages depend on behaviour

7. **Chart `color` values.** `odsChartSerie color` says "see colors below", but the description has no colors section (`highcharts.js:2323`). The actual grammar is in `services/colors.js:64-103` and accepts:
   - a hex or CSS color;
   - `range-<ColorBrewer name>` from the list at `colors.js:8-42` (`Set1`, `Set2`, `Paired`, `YlGnBu`, …);
   - `range-custom`, which uses the portal theme's `ODSWidgetsConfig.chartColors` and is dropped when that config is absent (`highcharts.js:2405`);
   - `custom-…` and `single-…` prefixes;
   - a **JSON array string** starting with `[`.

   The Example Pages use `range-Set1`, `range-custom`, and `color="{{ palettes[...] }}"`, which interpolates an array into exactly that JSON-array form.
8. **`odsChartQuery context` is mandatory but missing from `@param`.** The code runs `attrs.context.trim()` and then `scope[context].wait()` (`highcharts.js:2272-2273`) and throws without it. It appears only in the `odsChart` inline examples. All 6 uses in the Example Pages set it.
9. **`odsChartQuery sort`** is documented, but the code rewrites `y` to `serie1` (`highcharts.js:2237-2243`). The docs explain `series{n}-{m}` and leave out this shorthand mapping.
10. **`odsAnalysis` serie names are lowercased.** `ods-analysis-serie-myValue` ends up as result key `myvalue` (`analysis.js:157`). The `ods-analysis-aggregation-*` attribute family (`analysis.js:167-174`) is undocumented.
11. **`odsAdvAnalysis` result limit.** Without `group-by` the code forces `limit = 1` (`advanced-analysis.js:136`). With `group-by` it sets no limit, so the API default applies. The Example Pages set `ods-adv-analysis-limit="10000"` for municipality lists but leave it unset for regions.
12. **Scope visibility (a nesting rule nobody documents).** `odsResults`, `odsFacetResults`, `odsAggregation`, `odsAdvAnalysis` and `odsDatasetContext` declare `scope: true` (`results.js:64`, `facet-results.js:54`, `aggregation.js:92`, `advanced-analysis.js:118`, `dataset-context.js:145`). Their variable or context is visible **only on that element and its descendants**. `odsAnalysis` and `odsColorGradient` have no child scope and write into the enclosing scope (`analysis.js:127-135`, `analysis.js:297-300`). This is why the Example Pages wrap `ods-select` *inside* the `ods-facet-results` / `ods-adv-analysis` element, and why one page passes state to tooltip contexts through `$root.shared`. The docs only say "nested within".
13. **Undocumented attributes that the source reads:**
    - `odsMapLayer`: `join-context`, `local-key`, `remote-key`, `hover-field`, `color-scale`, `color-ranges` and `color-function` are explained in description prose (`map.js:1415,1521-1533`) but have no `@param` row; `geo-field` isn't mentioned at all.
    - `odsChart`: `single-y-axis-scale`.
    - `odsTable`: `sort`, `dataset-feedback`.
    - `odsTextSearch`: `button`.
    - `odsSimpleTab`: `slug`.
    - `odsColorGradient`: `ods-color-gradient-logarithmic-scale-factor`.
14. **API version split.** `odsAnalysis` and `odsAggregation` call the v1 `analyze`/records API. `odsAdvAnalysis` calls Explore v2.1 with ODSQL (`advanced-analysis.js:120,123`, converting the context's v1 parameters with `APIParamsV1ToV2`). This explains the comment on the Mittelverwendung page that the analyze API rejects `MAX(year(jahr))`.

### Things the Example Pages use that ods-widgets doesn't provide

- **The `currentLanguage` filter** (Beherbergungsstatistik, 3 uses) isn't defined anywhere in `ods-widgets/src`. It's a Huwise platform runtime addition.
- **The `ods-box` CSS class** (4 pages) isn't defined in `src/less`; it appears only once, inside an example comment in `date-range-slider.js:32`. It's a platform or theme class.
- **Dead attribute:** `stroke-width="3"` on `ods-chart-serie` (Referenztarife) isn't read anywhere in `src/`. The only `stroke-width` hit is in `src/less/components/gauge.less`.

## What the Example Pages use

These counts come from parsing the 8 `index.html` files. "Pages" means how many of the 8 use it.

### Widgets, ranked

| Rank | Widget | Form | Occurrences | Pages |
|---|---|---|---|---|
| 1 | odsSelect | element | 25 | 6 |
| 2 | odsResults | attribute | 21 | 5 |
| 3 | odsFacetResults | attribute | 16 | 5 |
| 4 | odsDatasetContext | element | 15 | **8** |
| 5 | odsMapLayer | element | 11 | 6 |
| 6 | odsSimpleTab | element | 10 | 4 |
| 7 | odsAdvAnalysis | attribute | 9 | 2 |
| 8 | odsMap | element | 6 | 6 |
| 9 | odsChartQuery / odsChartSerie | element | 6 / 6 | 4 |
| 10 | odsChart | element | 5 | 4 |
| 11 | odsSimpleTabs | element | 4 | 4 |
| 12 | odsAnalysis | attribute | 3 | 2 |
| 13 | odsColorGradient, odsLegend, odsTable, odsAggregation | mixed | 2 each | 1–2 |
| 14 | odsGauge, odsTextSearch | element | 1 each | 1 |

That's **19 Widgets in use out of 67**. The attribute-form Widgets that expose data (`odsResults`, `odsFacetResults`, `odsAdvAnalysis`) are the backbone of filters, KPIs and HTML tables, even though counting elements alone hides them.

**Most-used attributes:**

- `ods-select`: `options`, `selected-values`, `placeholder` (25 each); `label-modifier`, `value-modifier`, `multiple` (21 each).
- `ods-map-layer`: `context`, `display` (11 each); `title` (9); `tooltip-disabled`, `color` (6 each); `color-categories`, `color-by-field`, `shape-opacity` (4 each).
- `ods-map`: `toolbar-geolocation`, `toolbar-drawing` (6 each, always `false`).
- `ods-chart-query`: `context`, `field-x` (6 each); `series-breakdown` (4).
- `ods-chart-serie`: `expression-y`, `chart-type`, `function-y` (6 each); `color`, `scientific-display` (5 each).

### Filters, ranked

| Filter | Uses | Pages | Provided by |
|---|---|---|---|
| `filter` (`(arr \| filter:{k:'v'})[0]`) | 97 | 1 | AngularJS core |
| `number:N` | 67 | 4 | AngularJS core |
| `moment:'fmt'` | 12 | 2 | ods-widgets (`filters.js`) |
| `date` | 8 | 4 | AngularJS core |
| `currentLanguage` | 3 | 1 | **Huwise platform, not ods-widgets** |
| `toObject:'key'` | 2 | 1 | ods-widgets (`filters.js:861`) |

### Expression idioms, ranked (none of them are covered by the ods-widgets docs)

| Idiom | Uses | Pages |
|---|---|---|
| Binding a filter Widget to a context: `selected-values="ctx.parameters['refine.field']"`, or reading it | 83 | 7 |
| `item.fields.X` / `arr[0].fields.X` on `odsResults` output | 82 | 5 |
| `record.fields.X` in custom map-layer tooltips | 35 | 6 |
| `ng-if` guards (data loaded, selection made, "no data" panels) | 32 | 6 |
| `'disjunctive.X': true` in context parameters (multi-select facets) | 27 | 4 |
| Side-effect assignment inside interpolation: `{{ ctxB.parameters['refine.x'] = ctxA.parameters['refine.x']; '' }}` (syncing contexts, setting defaults) | 20 | 4 |
| `ng-init` for constants, palettes and local state | 12 | 3 |
| `$root.shared` to pass state into map-tooltip scopes | 11 | 1 |
| `ctx.dataset.metas.data_processed \| date` ("Letzte Aktualisierung") | 8 | 4 |
| `''+value` string coercion in `refine.*` parameters | 4 | 4 |
| A nested `ods-dataset-context` inside `ods-map-layer` for per-shape tooltip queries (`refine.x: ''+record.fields.y`) | 3 | 3 |
| `q:` query parameter (`NOT (…)`, `NOT #null(field)`) | 3 | 1 |
| `<ctx>-domain="https://public.opendatasoft.com/"` for a companion geo dataset on another portal | 2 | 2 |

The documented context properties (`parameters`, `dataset`, `nhits`, `getDownloadURL`, …) are covered in the `odsDatasetContext` and `odsResults` docs. **The structure of `dataset.metas` is not.**

### CSS hooks the stylesheets override (undocumented in ngdoc; only in `src/less`)

- **ods-widgets classes:** `odswidget-map-tooltip*` (most-used), `odswidget-legend*`, `ods-simple-tabs*` (including `-nav`, `-nav-link`, `-nav-link-active`), `odswidget-map`, `odswidget-gauge*`, `odswidget-map-display-control`.
- **Third-party classes:** Leaflet popup classes (`leaflet-popup-content`, `-wrapper`, `-tip`, `-close-button`) and about 20 `highcharts-*` classes.

## Could a compact Widget reference be generated mechanically?

**Parameter tables: yes.** The ngdoc structure is regular: `@name`, `@restrict`, `@param {type} [name=default] text`, `@description`, `@example`. A ~60-line Python script extracted all 67 Widgets, their 354 params, defaults and example presence. It also reconciled them with the registered directive names and the `require:` nesting.

What the extractor has to handle:

- converting camelCase params to kebab-case attributes;
- expanding placeholder families (`[Variablename]`, `[context]`, `serie[Name]`);
- treating `<i>(mandatory)</i>` text as the real required flag, since bracketing is inconsistent;
- skipping legacy blocks that have `@name` but no `@ngdoc`.

**Correctness layer: no, this has to be written by hand.** It covers items 1–14 above, the platform-only features (`currentLanguage`, `ods-box`), the expression idioms, scope visibility, and the color grammar. None of these can be extracted from ngdoc. Several of them, like the scope rules and the color grammar, were only found by reading code. The Example Pages are a useful but **imperfect** ground truth, since they contain at least one ignored attribute.

**Size estimates.** Tokens are estimated at 3.5–4 characters per token; these are not tokenizer measurements.

| Scope | Characters | Tokens (est.) |
|---|---|---|
| All 67 Widgets, raw ngdoc | 155,247 (46,183 of it `@example`) | 39k–44k |
| All 34 documented filters, raw ngdoc | 10,916 | about 3k |
| The 19 Widgets used in the Example Pages, raw ngdoc | 78,254 | 20k–22k |
| Compact reference (params, defaults, accepted values, one line each) for the 19, plus hand-written gotchas | not measured | **about 8k–12k** |

The 19 used Widgets account for 180 of the 354 `@param` rows. At about 25–35 tokens per compact row that comes to roughly 5–6k tokens. Adding a hand-written gotchas and idioms section of about 3–5k tokens gives the 8–12k estimate. A compact table for all 67 Widgets would be roughly double the parameter part, about **15–20k tokens**.

## Method

- Parsed every `/** … @ngdoc … */` block in `ods-widgets/src/**/*.js` and every `.directive('…')` / `.filter('…')` registration.
- For each directive, compared its `@param` names with the attributes the code reads: isolate-`scope` keys, `attrs.X`, `attrs['X']` and `$attrs.X`. Every disagreement listed above was then confirmed by reading the cited lines; heuristic hits that turned out to be dynamic-attribute templates or delegation were dropped.
- Compared the `src` ngdoc names against `docs/partials/api/*.html`.
- Read all 8 Example Page `index.html` files in full, and counted element/attribute Widgets, pipe filters (excluding `||`), expression idioms and CSS classes in `stylesheet.css`.
- **Not done:** checked the hosted docs (help.huwise.com/widgets); ran any Page in a browser; tokenized with a real tokenizer.
