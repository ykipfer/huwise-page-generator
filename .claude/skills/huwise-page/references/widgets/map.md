# Widget family: map

Widgets: `ods-map` > `ods-map-layer`, plus `ods-color-gradient` (feeds a layer's `color-categories`) and `ods-legend` (reads the gradient). They are used together, so they share this file.

Parameter tables were generated once from the ngdoc in the ods-widgets **source** (2.1.2, `ods-widgets/src/directives/`, never the stale `docs/` build) and are now maintained by hand. The verifier reads the first column of every table under a `## `ods-…`` heading: an attribute on a listed Widget that appears in none of its tables is reported as warning `undocumented-widget-attribute` (it never fails a Page). A parameter verified in the source but missing from the ngdoc goes into that Widget's "Real but undocumented" table, with its source line, and then stops warning. `<context>` and `<variablename>` in an attribute name stand for any name.

## `ods-map`

Element or attribute (`src/directives/map.js:42`). ngdoc: `src/directives/map.js:45`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `context` | DatasetContext |  | (mandatory) Dataset Context to use. If the **context** parameter is managed with odsMapLayer, it should not be configured for odsMap. | 48 |
| `location` | string |  | Controls the default location of the map upon initialization. The value must be set under the following format: `zoom,latitude,longitude`. For example, if you want to have a map centered on Paris, France, you should use `12,48.85218,2.36996`. By default, if a location is not specified, the map will try to fit all the … | 49 |
| `basemap` | string |  | Identifier of the basemap to use by default, as defined in ODSWidgetsConfig.basemaps. By default, the first available basemap will be used. | 52 |
| `min-zoom` | integer | `none` | Limits the map to a minimum zoom value. By default, this is defined by the minimum zoom of the basemap. | 53 |
| `max-zoom` | integer | `none` | Limits the map to a maximum zoom value. By default, this is defined by the maximum zoom of the basemap. | 54 |
| `scroll-wheel-zoom` | boolean | `true` | When set to `true`, scrolling the mouse wheel over the map can be used to zoom in or zoom out. | 55 |
| `static-map` | boolean | `false` | When set to `true`, the map can't be zoomed in/out or moved. Markers are still clickable. | 56 |
| `no-refit` | boolean | `false` | By default, the map refits its view whenever the displayed data changes. When set to `true`, the map stays at the same location. | 57 |
| `toolbar-geolocation` | boolean | `true` | When set to `true`, the "geolocate" button is displayed in the map's toolbar. | 58 |
| `auto-geolocation` | boolean | `false` | When set to `true`, the geolocation, which centers and zooms the map on the user's location, is automatically done upon initialization. `autoGeolocation` is only available when there is no **location** parameter set for the widget. Caution: location sharing must be allowed priorly for Firefox users when multiple … | 59 |
| `toolbar-drawing` | boolean | `true` | When set to `false`, the drawing tools to draw filter areas are not displayed in the map's toolbar. | 62 |
| `toolbar-fullscreen` | boolean | `true` | When set to `false`, the "fullscreen" button is not displayed in the map's toolbar. | 63 |
| `display-control` | boolean | `false` | When set to `true`, displays a control to choose whether groups or single datasets outside groups should be displayed, using toggle buttons. Note: it shouldn't be combined with the usage of **showIf** on odsMapLayer, as it will lead to inconsistencies in the user interface. | 64 |
| `display-control-single-layer` | boolean | `false` | When set to `true`, only one layer is displayed at a time using the control of groups and single datasets display. | 67 |
| `ods-auto-resize` | boolean |  | For more information, see Auto Resize. | 68 |
| `search-box` | boolean | `false` | When set to `true`, a search box is displayed on the map so that users can jump to another location through a search or search specific data on the map. | 69 |
| `display-legend` | boolean | `true` | When set to `true`, a caption is displayed in the bottom right corner of the map. | 70 |
| `sync-to-url` | boolean | `none` | When set to `true`, the settings of the **location** and **basemap** parameters are used in the page's URL. | 71 |
| `sync-to-object` | Object | `none` | An object updated by the map's settings for the **location** and **basemap** parameters corresponding to new changes of location and basemap. | 72 |

## `ods-map-layer`

Element or attribute (`src/directives/map.js:1395`). ngdoc: `src/directives/map.js:1398`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `context` | DatasetContext |  | (mandatory) Dataset Context to use | 1401 |
| `show-if` | expression | `none` | AngularJS expression to evaluate: if it evaluates to true, the layer is visible. | 1402 |
| `show-zoom-min` | number | `none` | Makes the layer visible only if the zoom level is superior or equal to the value. | 1403 |
| `show-zoom-max` | number | `none` | Makes the layer visible only if the zoom level is inferior or equal to the value. | 1404 |
| `display` | string | `auto` | Map mode: - `auto`: automatically chooses the best map mode to easily display the data, based on the number of points and type of geometry - `heatmap`: displays the data as a heatmap, i.e. a density of points represented by a color intensity variation. It can also be based on the result of an aggregation function. - … | 1406 |
| `function` | string | `none` | For the `heatmap`, `choropleth`, and `clusters` modes only–function used to aggregate the data: - AVG: average - COUNT - MIN: minimum - MAX: maximum - STDDEV: standard deviation - SUM | 1416 |
| `expression` | expression | `none` | Expression used to aggregate the data. This parameter is not required when the function is COUNT. | 1424 |
| `color` | string | `none` | Color of the displayed shapes and markers | 1426 |
| `border-color` | string | `white` | Color of the shapes' borders | 1427 |
| `border-size` | number | `1` | The width of the shapes' borders, in pixels | 1428 |
| `border-pattern` | string | `solid` | Pattern of the shapes' borders: - `solid` - `long-dashes` - `medium-dashes` - `short-dashes` - `dots` - `short-dot` - `short-dot-dot` - `medium-short` | 1429 |
| `border-opacity` | number | `1` | Opacity of the shapes' borders. The value must be between `0` (transparent) and `1` (opaque). | 1440 |
| `shape-opacity` | number | `0.5` | Opacity of the shapes. The value must be between `0` (transparent) and `1` (opaque). | 1441 |
| `point-opacity` | number | `1` | Opacity of the markers. The value must be between `0` (transparent) and `1` (opaque). | 1442 |
| `line-width` | number | `5` | The width of the lines, in pixels. Only applicable for "line" type shapes. | 1443 |
| `color-categories` | objet | `none` | For the `categories` mode only–object that links textual values and colors (e.g., `{'Paris': '#FF0000', 'Nantes: '#00FF00'}`). | 1445 |
| `color-categories-other` | string | `none` | For the `categories` mode only–default color for values that were not originally taken into account by the `color-categories` object. | 1446 |
| `color-undefined` | string | `none` | For the `choropleth` mode only–default color for the `undefined` values. | 1447 |
| `color-out-of-bounds` | string | `none` | For the `choropleth` mode only–default color for values out of the expected `color-numeric-ranges` scale. | 1448 |
| `color-numeric-ranges` | string | `none` | For the `choropleth` mode only–color scale used (e.g., `{'0': '#FF0000', '1': '#FFFF00'}`). The key is the upper bound used for this color (e.g., still using the previous example, it would be #FF0000 until 0, then #FFFF00 until 1, etc.) | 1449 |
| `color-numeric-range-min` | number | `none` | For the `choropleth` mode only–minimum bound used. Any value below that bound will be considered out of the scale, and will use the color of the `color-out-of-bounds` parameter. | 1450 |
| `color-gradient` | string | `none` | For the `heatmap` mode only–object that links upper numeric bounds and colors (e.g., `{0.2: '#FF0000', 1: '#00FF00'}`) | 1451 |
| `color-by-field` | string | `none` | For categories and choropleth modes only - Field used to choose the color | 1452 |
| `radius` | number | `4` | For the `heatmap` mode only–width of the perimeter | 1454 |
| `size` | number | `4` | For markers, 7 for pictograms–size of the markers | 1455 |
| `size-min` | number | `3` | For the `clusters` mode only–minimum size of the clusters | 1456 |
| `size-max` | number | `5` | For the `clusters` mode only–maximum size of the clusters | 1457 |
| `size-function` | string | `none` | For the `clusters` mode only–calculation function of the clusters size: - `linear` - `log` (logarithmic) | 1458 |
| `picto` | string | `none` | Pictogram used for the markers | 1463 |
| `show-marker` | boolean | `none` | When set to `true`, displays a marker around the pictogram. | 1464 |
| `tooltip-sort` | string |  | Identifier of the field used to sort tooltips that represent several records for the same point or shape. Note that `-` before the name of the sorting method indicates that the sorting will be descending instead of ascending. By default, numeric fields are sorted in decreasing order, date and datetime are sorted … | 1466 |
| `tooltip-disabled` | boolean | `none` | When set to `true`, clicking on a point or shape does not display the associated tooltip. | 1471 |
| `caption` | boolean | `none` | When set to `true`, displays a caption for the map layer in the bottom right corner of the map. | 1472 |
| `caption-title` | string | `none` | Title of the map layer caption. | 1473 |
| `caption-picto-color` | string | `none` | Color used for the caption's pictogram | 1474 |
| `caption-picto-icon` | string | `none` | Pictogram used in the caption | 1475 |
| `title` | string | `none` | Title used in the map layer's control selection | 1476 |
| `description` | string | `none` | Description used in the map layer's control selection | 1477 |
| `exclude-from-refit` | boolean | `none` | When set to `true`, the calculation that rezooms the map when filters or data change does not take the map layer into account. | 1478 |
| `refine-on-click-context` | string | `none` | Name, or list of names separated by commas (`[ctx1, ctx2]`) of contexts that should be refined when clicking on a point or shape of the map layer. | 1480 |
| `refine-on-click-map-field` | string | `none` | (or `refine-on-click-CONTEXTNAME-map-field` if more than one context) - Field of the map layer that is used to retrieve the value used for the refine | 1481 |
| `refine-on-click-context-field` | string | `none` | (or `refine-on-click-CONTEXTNAME-context-field` if more than one context) - Field used in the context of the refine (`refine.FIELDNAME=VALUE`) | 1482 |
| `refine-on-click-replace-refine` | boolean | `none` | (or `refine-on-click-CONTEXTNAME-replace-refine` if more than one context) - When set to `true`, each click replaces the previous refine instead of adding to it. | 1483 |

Real but undocumented (read in the source, absent from the ngdoc; no lint warning):

| Attribute | Type | Description | Source |
|---|---|---|---|
| `opacity` | number | Fallback for `shape-opacity` and `point-opacity` when those are absent. | map.js:1802 |
| `color-scale` | string | ColorBrewer scheme name; `aggregation` display only. Described in the prose of the colour notes. | map.js:1737 |
| `color-ranges` | string | Colours and ranges separated by `;`. Described in the prose of the colour notes. | map.js:1742 |
| `color-function` | string | `log` for a logarithmic colour scale. Described in the prose of the colour notes. | map.js:1797 |
| `hover-field` | string | Field of the joined dataset shown on hover. Part of the native join, described in the prose of `display`. | map.js:1812 |
| `geo-field` | string | Geo field to draw, when the dataset has several. | map.js:1827 |
| `join-context` | expression | Native join. **Banned** (`banned-native-join`). | map.js:1857 |
| `local-key` | string | Native join key. **Banned** together with `join-context`. | map.js:1809 |
| `remote-key` | string | Native join key. **Banned** together with `join-context`. | map.js:1810 |

## `ods-color-gradient`

Attribute (`src/directives/analysis.js:215`). ngdoc: `src/directives/analysis.js:218`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `ods-color-gradient` | string |  | Variable name to use to output the color gradient data structure. variable['colors'] can be used in ods-maps. 'values', 'range' keys are also available. | 221 |
| `ods-color-gradient-context` | DatasetContext |  | Dataset Context to use | 222 |
| `ods-color-gradient-x` | string |  | The X-axis of the analysis | 223 |
| `ods-color-gradient-serie` | string |  | FUNC(expression) where FUNC is AVG, SUM, MIN, MAX, etc... and expression is the field id to work on. | 224 |
| `ods-color-gradient-high` | string | `'rgb(0, 55, 237)'` | RGB or HEX color code for highest value of the analysis serie. ex: "rgb(255, 0, 0)", "#abc" | 225 |
| `ods-color-gradient-low` | string | `'rgb(180, 197, 241)'` | RGB or HEX color code for the lowest value of the analysis serie. ex: "rgb(125, 125, 125)", "#ff009a" | 226 |
| `ods-color-gradient-nb-classes` | integer | `undefined` | Number of classes, ie number of color to compute. Mandatory to get a consistent legend with the corresponding number of grades/classes. | 227 |
| `ods-color-gradient-pow-exponent` | integer | `undefined` | Set to `1` for a linear scale (default value), to `0.3` to approximate a logarithmic scale. Power scale tends to look like a log scale when the exponent is less than `1` and tends to an exponential scale when bigger than `1`. | 228 |

Real but undocumented (read in the source, absent from the ngdoc; no lint warning):

| Attribute | Type | Description | Source |
|---|---|---|---|
| `ods-color-gradient-logarithmic-scale-factor` | integer | Legacy 1 to 10; used only when `pow-exponent` is absent. | analysis.js:312 |

## `ods-legend`

Element (`src/directives/legend.js:6`). ngdoc: `src/directives/legend.js:9`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `color-gradient` | object |  | An object providing colors, values, and a range of value. It also provides the number of classes for the `steps` display mode. | 13 |
| `title` | string |  | Legend title | 14 |
| `subtitle` | string | `''` | Legend sub-title | 15 |
| `no-value-color` | string | `undefined` | Displays another step or square with the provided default color. The authorized values are any HTML color code. | 16 |
| `decimal-precision` | integer | `0` | Sets the decimal values precision. | 17 |
| `display` | string | `linear` | Display mode. The authorized values are 'steps' and 'linear'. | 18 |

## Correct usage

Every claim cites `ods-widgets/src/directives/<file>:<line>`; re-check them after a Huwise upgrade.

**`ods-map`**

- The tag is **not** replaced (the directive has no `replace`): `<ods-map>` stays in the DOM around a generated `div.odswidget.odswidget-map` (`map.js:146-148`). The `id`, `style` and `class` of the `<ods-map>` element are copied to the inner `div.odswidget-map__map` (`map.js:168-170`).
- The default stylesheet gives `.odswidget-map` `min-height: 400px` (`less/components/map.less:1-5`). A Page whose map area is shorter than 400px must override that rule in its CSS, or the map overflows its card. The CI minimum map height is 280px.
- `scroll-wheel-zoom` is a string compared with `!== 'false'` (`map.js:328`): any other value, or none, leaves wheel zoom on. Every Page writes `scroll-wheel-zoom="false"` (lint: `required-widget-attribute`). `static-map="true"` also turns it off (`map.js:339-341`).
- `location` is `zoom,latitude,longitude`; without it the map fits the data (ngdoc). The ngdoc types `scroll-wheel-zoom` as a boolean, but the scope binds it as a string (`map.js:135`).
- `auto-resize` and `ods-auto-resize` are bound (`map.js:130,171`) but banned: the Page has a fixed pixel height (ADR 0002).
- `map-config` and `dynamic-config` are bound (`map.js:142-143`) but are not in the ngdoc. A Page doesn't use them.

**`ods-map-layer`**

- The content of the element is taken as the **tooltip template** and compiled separately (`map.js:1715-1722,1731`). Put the tooltip's own context (`tipctx`) inside it.
- Contradiction: nine scope attributes are read by the layer but have no `@param`: `opacity`, `color-scale`, `color-ranges`, `color-function`, `hover-field`, `geo-field`, `join-context`, `local-key`, `remote-key` (`map.js:1657-1712`). The colour ones and the join ones are described only in the prose of `display` and the colour notes (`map.js:1415,1524-1531`). They are listed in the "Real but undocumented" table so they don't warn. The three join attributes stay banned (`banned-native-join`).
- The colour attributes are tried in a fixed order and the first present one wins: `color`, `color-scale`, `color-ranges`, `color-categories`, `color-gradient`, `color-numeric-ranges`, `color-by-field` (`map.js:1735-1793`). A choropleth sets only `color-categories` (+ `color-by-field`).
- `color-categories` needs `color-by-field`, or the Widget logs an error (`map.js:1754`). `color-categories-other` is the colour for shapes without a key (`map.js:1761-1763`).
- `shape-opacity` defaults to 0.5 (ngdoc, `map.js:1441`), which washes out CI colours. Set it explicitly (`0.85` or `1`).
- `show-if` is an expression (`=`, `map.js:1659`); `show-zoom-min` and `show-zoom-max` are strings.
- Contradiction: the ngdoc says restrict `E`; the source allows `EA` (`map.js:1656`).
- A layer requires an `ods-map` ancestor (`require: ^odsMap`, `map.js:1726`).

**`ods-color-gradient`**

- It has **no** `scope: true` (`analysis.js:298`): the variable is written into the enclosing scope (`analysis.js:299-300`), so everything inside the element (and its siblings in that scope) reads it. This is the one data Widget that does not create a scope (core.md, "The scope rule").
- The variable is `{ colors, values, range }`. `colors` maps each X value to an `rgb(r,g,b)` string (`analysis.js:420`), `values` to the numbers, `range` holds `min`, `max`, `low-color`, `high-color`, `classes` (`analysis.js:299-303`). Pass `colors['colors']` to `color-categories`.
- The `colors` object is emptied and refilled in place, not replaced, so map watchers keep firing (`analysis.js:376-381`).
- Keys are the values of `ods-color-gradient-x` exactly as the API returns them (`analysis.js:420`). The map side must use the same value in `color-by-field`.
- Contradiction: only `#abc`, `#aabbcc` and `rgb(r, g, b)` are accepted for `-high` and `-low` (`analysis.js:270-271,274-294`). Any other CSS colour (names, `hsl()`) silently falls back to the default blue (`analysis.js:305-309`).
- `ods-color-gradient-serie` is `FUNC(field)`; it is sent as a v1 analyze request with `maxpoints: 0` (`analysis.js:339-347`).
- `ods-color-gradient-nb-classes` switches to a stepped scale and is required for a legend in `steps` mode (`analysis.js:331,371`, `legend.js:150-153`). `ods-color-gradient-pow-exponent` below 1 approximates a logarithmic scale (ngdoc); the legacy `-logarithmic-scale-factor` is read only when it is absent (`analysis.js:311-325`).

**`ods-legend`**

- The tag is replaced by `div.odswidget.odswidget-legend` (`replace: true`, `legend.js:86-88`).
- `color-gradient` is an expression that must already resolve to the `ods-color-gradient` variable: the watcher reads `nv.range.min` without a guard (`legend.js:142`). Place the legend inside the element that defines the gradient.
- Nothing is drawn until the gradient has a `range.min` (`legend.js:142-144`). `display` is `linear` (default) or `steps`; any other value is treated as linear (`legend.js:147,149`). `steps` without `nb-classes` on the gradient only logs an error (`legend.js:150-153`).
- `no-value-color` adds a "no value" entry in the given colour (`legend.js:163-164,172`); match it to `color-categories-other`.
