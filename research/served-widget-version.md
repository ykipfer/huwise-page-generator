# Which ods-widgets version and libraries does data.gr.ch serve to Pages?

Research for [#3](https://github.com/ykipfer/huwise_page_generator/issues/3). Inspected 2026-10-16.

## Conclusion

Every **Page** on data.gr.ch runs **ods-widgets 2.1.2** on **AngularJS 1.8.3**, **jQuery 3.7.0** and **Leaflet 0.7.3**.
Charts use **Highcharts 6.1.4** (2018), not the 11.1.0 that ods-widgets 2.1.2 references upstream. The portal overrides the library's lazy-loader and serves its own copies from `/static/vendor/`.

The local `ods-widgets/` checkout is upstream `master` at `2d27149` (2.1.2 plus two rebranding commits). The served bundle contains those rebranding changes as well. Of the 89 Widgets in both, the attribute API is identical for every documented attribute. The only real differences:

- The served bundle has 3 platform-only Widgets that are not in the public repo: `odsAgent`, `odsArtifact` and `odsImportScript`.
- `odsPicto` in the local source has an internal, undocumented `origin` scope binding. The served build doesn't have it.

**The local checkout is a valid reference for Widget knowledge.** Chart behaviour must be checked against Highcharts 6.1.4, not 11.

## Served stack

All values come from the live Page HTML and the files it loads. The same bundles were served for `/pages/homepage/`, `/pages/finanzkennzahlen-der-buendner-gemeinden/`, `/pages/dashboard-ueberbauungsstand/`, `/pages/dvs_awt_econ_202502032/` (Beherbergungsstatistik) and `/pages/mittelverwendung-im-bereich-landeslotterie/`.

| Library | Served version | Served from | Upstream 2.1.2 references | Evidence |
|---|---|---|---|---|
| ods-widgets | **2.1.2** | `/static/compressed/js/output.1185628e843d.js` | 2.1.2 | Bundle starts `var version='2.1.2';var mod=angular.module('ods-widgets',…)` |
| AngularJS | **1.8.3** | `/static/compressed/js/output.ebb7fb5cf398.js` (plus `/static/vendor/angular-1.8.3/i18n/angular-locale_<lang>.js`) | 1.8.x ("officially support AngularJS 1.8"; README samples use 1.8.2) | `full:'1.8.3'` in bundle; vendor path |
| jQuery | **3.7.0** | same bundle as AngularJS | 2.1+ / 3 | `jQuery JavaScript Library v3.7.0` banner |
| Highcharts (+ more, treemap, funnel, no-data-to-display) | **6.1.4** (2018-09-25) | `/static/vendor/highcharts/*.js` | **11.1.0** from `code.highcharts.com` | Banner `Highcharts JS v6.1.4 (2018-09-25)` in `highcharts.js` and `treemap.js` |
| Highcharts i18n | de-ch / en-us | `/static/vendor/highcharts-i18n/<lang>.js` | – | Platform-only file |
| Leaflet | **0.7.3** | `/static/vendor/leaflet/leaflet.js` | 0.7.3 (cdnjs) | `o.version="0.7.3"` |
| leaflet-locatecontrol | (v0.24.0-era, no version string) | `/static/vendor/leaflet-locatecontrol/` | v0.24.0 (mapbox CDN) | Path in override |
| ion.rangeSlider | 2.3.0 | `/static/vendor/ion-rangeslider-2.3.0/` | 2.3.0 | Path |
| simple-statistics | – | `/static/vendor/simple-statistics/simple-statistics.js` | 1.0.1 (cdnjs) | Path |
| he | 0.5.0 | `/static/vendor/he/he.js` | – | Banner `he v0.5.0` |
| ods-widgets `libs/` (ods-map, leaflet-draw, rome, fullcalendar, …) | as bundled with 2.1.2 | `/static/ods-widgets/libs/…` (`basePath: '/static/ods-widgets/'`) | same | HTTP 200 for `libs/ods-map/ods-map.js`, `libs/leaflet-draw/leaflet.draw.js`, `libs/rome/rome.standalone.js` |

### How the Highcharts swap happens

Upstream ods-widgets 2.1.2 lazy-loads Highcharts 11.1.0 from the Highcharts CDN (`ods-widgets/src/services/utils.js`, lines 12-21). Each Page's inline script replaces that config (source: Page HTML, e.g. `https://data.gr.ch/pages/homepage/`):

```js
ods.config(function (ModuleLazyLoaderProvider) {
    var loadingConfig = ModuleLazyLoaderProvider.getConfig();
    // We can't rely on CDNs, especially because some ITs are using a whitelist and won't add our CDNs in it.
    // Let's use our local copies
    loadingConfig.highcharts.js = [
        ["/static/vendor/highcharts/highcharts.js"],
        ["/static/vendor/highcharts/no-data-to-display.js"],
        ["/static/vendor/highcharts-i18n/en-us.js", "/static/vendor/highcharts/highcharts-more.js",
         "/static/vendor/highcharts/treemap.js", "/static/vendor/highcharts/funnel.js"]
    ];
    loadingConfig.leaflet = { /* /static/vendor/leaflet/leaflet.js + ods-widgets libs/ */ };
    …
});
```

The ods-widgets source does not check `Highcharts.version` anywhere: no match in the served bundle or in `ods-widgets/src/directives/highcharts.js`. So the **Widget attribute syntax** (`ods-chart`, `ods-chart-query`, `ods-chart-serie`) is unaffected. The gap only matters for things Highcharts itself renders: defaults, styling and any feature added after v6. Every chart type ods-widgets offers (`line`, `spline`, `arearange`, `areasplinerange`, `columnrange`, `treemap`, `area`, `areaspline`, `column`, `bar`, `pie`, `scatter`, `spiderweb`, `polar`, `funnel`, `boxplot`; `ods-widgets/src/services/charts.js`, lines 82-122) is covered by the modules served: core, `highcharts-more`, `treemap` and `funnel`.

## Local checkout vs. served

### Local checkout identity

- `ods-widgets/.git/HEAD` → `refs/heads/master` = `2d27149aa641fe0771ea1bddb937885d3bbccf74`. That is upstream `opendatasoft/ods-widgets` `master` (2025-10-29). It is the latest commit, and latest tag is `2.1.2`.
- GitHub compare `2.1.2...2d27149`: 2 commits ahead ("Release Documentation update (rebranding)" and a merge), with no code features. `dist/ods-widgets.js` changes are Opendatasoft→Huwise strings, `*.huwise.com` allowed as a context domain and picto host, a `displayLanguage` argument for `fieldsForLanguageDisplay` in map tooltips, and HTML-to-text for reuse descriptions.
- `ods-widgets/CHANGELOG.md` top entry: `2.1.2 - 2025-07-21`. `package.json` carries no version (`0.0.0`).

The served bundle already contains these post-2.1.2 changes: `static.huwise.com/georef`, `fieldsForLanguageDisplay:displayLanguage`, `huwise.com` host checks. So the served build is at least as new as local `master`, even though it still reports `2.1.2`.

### Widget (directive) comparison

Method: extract `.directive('<name>'` and each directive's `scope:{…}` and `require` from `output.1185628e843d.js` (served) and `ods-widgets/dist/ods-widgets.js` (local), then compare with whitespace and comments removed.

- Served: 92 directives. Local: 90 (`translate` from angular-gettext is bundled separately on the portal).
- **89 shared directives. Every documented attribute binding is identical.** The raw diff also flagged `odsMap`, `odsMapLayer`, `odsMapLegacy`, `odsMapTooltip` and `odsTable`, but those differences were only trailing `//` source comments. They are not real differences.
- `odsPicto`: local scope has `origin: '='`, served doesn't. It is an internal Symbol flag that `odsThemePicto` uses to bypass the picto URL whitelist (`ods-widgets/src/directives/picto.js`, lines 10, 82, 165). It is not documented (no `@param`). It doesn't matter for Pages.
- `odsAnalyze`: the scope is identical. The served copy may not declare `require: ['?odsAutoResize','?autoResize']`. This is internal plumbing and doesn't change the attributes.

#### Platform-only Widgets in the Page bundle (absent from public repo and local checkout)

| Widget | Scope / attributes | What it does | Usable on data.gr.ch? |
|---|---|---|---|
| `ods-import-script` | `module-id` (`@`), `parameters` (`=?`), `load-css` (`@?`), `shadow-dom` (`@?`) | Loads `/code-editor-custom-js/<module-id>/index.js` (and optionally `style.css`) into the Page, optionally in a shadow DOM | Exists in the bundle. Depends on modules authored in Huwise's code editor, so it was not tested |
| `ods-agent` | `scope:true`; reads `agent-name`, `mode`/`inline`/`launcher`/`callout` attrs | Embeds a Huwise AI agent chat widget | **No.** It requires `agentsTenantSlug`, which is `""` on data.gr.ch, so the widget shows "agents feature is not provisioned" |
| `ods-artifact` | `artifact-name`, `scope-type`, `scope-id` (`@`) | Embeds a Huwise "artifact" via `artifact-widget-loader.js` | **No.** Same `agentsTenantSlug` gate |

### Other bundles on the portal are not available to Pages

The portal's 404 page loads a different widget bundle (`output.001b53916c1c.js`, module `ods.core`). It has about 100 extra internal directives (`odsTabs`, `odsModal`, `odsCollapsible`, `odsTooltip`, `odsCatalogCard…`, etc.). **Pages load only `output.1185628e843d.js` plus the small `odsDocumentMeta` bundle `output.e9c8905605ab.js`**. Internal directives seen elsewhere on the portal must not be used in a Page.

## Example Page coverage

Every Widget used across the 8 Example Pages (`page_examples/*/index.html`) exists in the served bundle with the same attributes.

- Element Widgets: `ods-select` (25), `ods-dataset-context` (15), `ods-map-layer` (11), `ods-simple-tab` (10), `ods-map` (6), `ods-chart-serie` (6), `ods-chart-query` (6), `ods-chart` (5), `ods-simple-tabs` (4), `ods-table` (2), `ods-legend` (2), `ods-text-search` (1), `ods-gauge` (1).
- Attribute Widgets: `ods-results`, `ods-facet-results`, `ods-adv-analysis`, `ods-analysis`, `ods-aggregation`, `ods-color-gradient`.
- `chart-type` values used: `column` (4), `bar` (2).
- None of the Example Pages contain `<script>` or `<link>` tags.

## Language (German Pages)

`?flg=de-ch` on a Page switches to `angular-locale_de-ch.js`, `highcharts-i18n/de-ch.js` and `ODSWidgetsConfig.language: "de"`. Without `flg`, these Pages default to `en-us` (source: `https://data.gr.ch/pages/finanzkennzahlen-der-buendner-gemeinden/?flg=de-ch`).

## Caveats

- The `output.<hash>.js` names are deploy snapshots and will change. `last-modified` on the served bundles and on `highcharts.js` was `Wed, 14 Oct 2026 16:50 GMT`. To re-check, fetch any `/pages/<slug>/`, open the `output.*.js` that starts with `var version=`, and read `/static/vendor/highcharts/highcharts.js`'s banner.
- The fetched Page HTML does not inline the Page body (only about 3 `<ods-*>` tags in the shell). The body is rendered client-side. The served CSS (`ods-widgets.css` vs. the portal's `front-angular.css`) was not compared.
- The page list came from the public Explore API, `https://data.gr.ch/api/explore/v2.1/catalog/assets?where=asset_type="ods_classicpage"` (24 Pages). The data.gr.ch MCP was not needed for this question.

## Sources

- Live: `https://data.gr.ch/pages/<slug>/` HTML (slugs above), `https://data.gr.ch/static/compressed/js/output.1185628e843d.js`, `…/output.ebb7fb5cf398.js`, `…/output.001b53916c1c.js`, `https://data.gr.ch/static/vendor/highcharts/highcharts.js`, `…/highcharts/treemap.js`, `…/leaflet/leaflet.js`, `…/he/he.js`, `https://data.gr.ch/api/explore/v2.1/catalog/assets`.
- Local (gitignored, owner's checkout): `ods-widgets/dist/ods-widgets.js`, `ods-widgets/src/services/utils.js`, `ods-widgets/src/services/charts.js`, `ods-widgets/src/directives/picto.js`, `ods-widgets/CHANGELOG.md`, `ods-widgets/README.md`, `ods-widgets/.git/{HEAD,refs/heads/master,packed-refs}`, `page_examples/*/index.html`.
- Upstream: `https://github.com/opendatasoft/ods-widgets/compare/2.1.2...2d27149aa641fe0771ea1bddb937885d3bbccf74`; tags list (latest `2.1.2`).
