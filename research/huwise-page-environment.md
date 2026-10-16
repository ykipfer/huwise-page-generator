# What environment does Huwise give a Page, and can it be rendered locally?

Research for [#5](https://github.com/ykipfer/huwise_page_generator/issues/5). Sources were fetched on 2026-10-16. The hashed bundle names below rotate with Huwise releases.

## Answer

- **Wrapper.** A Page's HTML is injected into the full portal page (or its `?headless=true` variant) and `$compile`d by AngularJS 1.8.3. It runs inside `ng-app="ods.frontend"`, in the scope of `PageController`. It is not isolated: anything on that scope or on `$rootScope` is visible, and Angular expressions (`{{ }}`, `ng-init`, `ng-click`) run.
- **CSS.** The Page CSS is written into a plain `<style>` element in the body. It is **not scoped** and applies to the whole document (the portal header, footer, and widget internals too).
- **What Huwise allows.** The platform documents that JavaScript and arbitrary iframes are not allowed. On save, stored HTML is re-serialised: comments are stripped and attributes are re-ordered. The exact allowlist cannot be observed from outside the editor.
- **Local rendering is feasible and faithful.** A local HTML harness can load the public ods-widgets build, query the live data.gr.ch API (CORS `*` on both v1 and v2.1), and use data.gr.ch's own CSS, fonts and vendor scripts. With those, a headless Chrome screenshot was nearly pixel-identical to the published Page (see the feasibility check below).
- **The harness must copy the platform's configuration, not the library defaults.** Most important: Highcharts **6.1.4** instead of the library's default 11.1.0. It also needs the domain's `ODSWidgetsConfig`, the German locale files, and a few platform-only filters.

## 1. What wraps a Page on data.gr.ch

Source: live HTML of published Example Pages, e.g. `https://data.gr.ch/pages/dvs_awt_econ_202502032/?flg=de-ch` (Beherbergungsstatistik), `/pages/mittelverwendung-im-bereich-landeslotterie/`, `/pages/finanzkennzahlen-der-buendner-gemeinden/`. The live URL of every Example Page is the `content_link` field of the public `assets-listing` dataset (`/api/explore/v2.1/catalog/datasets/assets-listing/records`, `asset_type = ods_classicpage`).

### Markup around the Page

```html
<main id="main" role="main" class="main--page">
  <div ng-app="ods.frontend" ng-controller="PageController">
    <div class="page-layout ng-cloak">
      <style type="text/css" ods-bind-angular-content="blocks.css"></style>
      <div ods-bind-angular-content="blocks.html"></div>
    </div>
  </div>
</main>
```

The Page itself arrives as an inline JSON literal in a script at the end of `<body>`:

```js
var app = angular.module('ods.frontend', ['ods', 'ods.core']);
app.controller('PageController', function ($scope, domainConfig, config) {
    $scope.blocks = {"html": "&lt;div ...", "css": "..."};   // HTML-escaped
    $scope.pageId = '<slug>';
    $scope.reusesEnabled = domainConfig['explore.enable_showcases'];
    $scope.user = { is_authenticated: config.USER !== null };
    $scope.domain = { languages: ..., current_language: ..., is_explore_agent_available: ... };
});
```

`odsBindAngularContent`, from the platform bundle `/static/compressed/js/output.bce6781d8d14.js`:

```js
link: function (scope, element, attrs) {
  var unwatch = scope.$watch(function(){ return scope.$eval(attrs.odsBindAngularContent); }, function (value) {
    var html = jQuery('<div />').html(value).text();   // un-escape
    element.html(html);
    if (element[0].tagName.toLowerCase() !== 'style') { $compile(element.contents())(scope); }
    unwatch();
  });
}
```

What follows from this:

- The HTML is compiled **once**, against `PageController`'s scope. There is no isolate scope. Page expressions can read and write `pageId`, `user`, `domain`, `blocks` and `$root`. Example Pages already rely on this: they write `ng-init="$root.shared…"` and assign `context.parameters[...]` inside `{{ }}`.
- The CSS goes into a `<style>` element in `<body>` and is **not compiled**. Because it sits after all portal `<link>`s, it wins ties in the cascade. Nothing prefixes or scopes it, so Example Pages' `body { background-color: … }` rules really do restyle the portal `<body>`.
- Without `?headless=true` the portal header and footer are present (they are part of the same document). With `?headless=true` the header element is empty and `appendedURLQuerystring: "headless=true"` is passed to the widgets.

### Angular modules and libraries loaded

| Thing | Platform value | Source |
|---|---|---|
| jQuery | 3.7.0 | header of `output.ebb7fb5cf398.js` |
| AngularJS | 1.8.3, plus `angular-locale_de-ch.js` for `flg=de-ch` | `/static/vendor/angular-1.8.3/i18n/…` script tag |
| ods-widgets | **2.1.2**, the same version as the local `ods-widgets/` checkout (CHANGELOG 2.1.2, `var version = '2.1.2'`) | `output.1185628e843d.js` |
| App modules | `ods.frontend` → `ods` → `ods.minimal`, `ods.core.config`, `ods.core`, `ods.core.form.directives`, `ods-widgets`, `gettext` | inline module definitions |
| moment | 2.29.4, `moment.locale("de-ch")` | `/static/vendor/moment-2.29.4/locale/de-ch.js` |
| Highcharts | **6.1.4**, served from `/static/vendor/highcharts/` (+ `highcharts-i18n/de-ch.js`, more, treemap, funnel). An inline comment in the page says: "We can't rely on CDNs … Let's use our local copies" | `ModuleLazyLoaderProvider` override in page; header of `/static/vendor/highcharts/highcharts.js` |
| Leaflet | 0.7.3, from `/static/vendor/leaflet/` | header of `leaflet.js` |
| Stylesheets | `font-awesome-4.7.0`, `normalize.css`, `odsui.css`, `/css/front-angular.css?44`, domain theme `…/kantongraubuenden/stylesheet/44.css` (S3), plus inline `@font-face` for *Eudoxus Sans* from `/assets/theme_font/` | `<head>` |

Widget CSS comes from **`front-angular.css`**, not from `ods-widgets.css`. It contains 368 distinct `odswidget*` classes, against 338 in the library's `dist/ods-widgets.css`, plus `.ods-box`. The `?44` is a theme revision that will change.

### `ODSWidgetsConfig` the platform sets (verbatim keys from the live page)

`disqusShortname: ""`, `basemaps` (jawg.sunny "Hell", jawg.streets "Strassen", jawg.matrix, custom WMS "Kantonales Strassennetz"; jawg key plus `jawg_odsdomain: "kantongraubuenden"`), `neutralBasemap`, `mapGeobox: false`, `chartColors: ["#0071bb","#ffcb06","#f03f48","#1bb6ea","#a7d59f","#7c795e","#231f20","#7199c6"]`, `language: "de"`, `themes: {…}`, `basePath: '/static/ods-widgets/'`, `websiteName`, `mapPrependAttribution`, `defaultMapLocation: "13,46.84986,9.5303"`, `secureContextDomain: true`, `localDomain: "kantongraubuenden"`, `currentPageSlug`, `appendedURLQuerystring`, `trustedIssuers`, plus `customAPIHeaders: {"ODS-API-Analytics-App": "page-<slug>"}`. `defaultDomain` keeps the library default `''`, so API calls are same-origin relative URLs.

The widget UI strings (e.g. map legend "Kein Wert") come from a large inline `gettextCatalog.setStrings('de', {...})` block. The local ods-widgets checkout ships **no** translations.

### Platform-only directives and filters

The platform bundles define 123 directives and 25 filters that the public library does not have. Examples: `odsTabs`, `odsPane`, `odsTooltip`, `odsCollapsible`, `odsCatalogSearch`, `odsPageContactForm`, `odsPageEnumerator`, `odsPagesList`, `odsRangeInput`. Filters include `currentLanguage`, `startsWith`, `range`, `toArray`, `siPrefixFormat`, `encodeURIComponent`, `diff`, `limitFrom` and others. The user guide documents some of them as usable "only in the Huwise environment" ([Content pages: ideas, tips & resources](https://userguide.huwise.com/en/articles/2255426), edited 2026-01-28).

- The 8 Example Pages use **only public-library Widgets** (`ods-select`, `ods-results`, `ods-facet-results`, `ods-dataset-context`, `ods-map`/`ods-map-layer`, `ods-simple-tabs`, `ods-adv-analysis`, `ods-chart*`, `ods-analysis`, `ods-color-gradient`, `ods-legend`, `ods-table`, `ods-aggregation`, `ods-gauge`, `ods-text-search`).
- One platform-only **filter** is used: Beherbergungsstatistik's footer uses `'de'|currentLanguage`.
- The portal homepage uses `ods-catalog-search`, which is platform-only.

### Language

A Page stores its HTML **per portal language**: the `de` and `en` fetches of the same Page return different `blocks.html`. On data.gr.ch the `en` slot holds Romansh text. The editor has a language selector at the top ([Creating Code editor pages](https://userguide.huwise.com/en/articles/2255490), edited 2026-10-13). `?flg=de-ch` selects the German content and German locale.

## 2. What is stripped or forbidden

**Documented.** "Due to security concerns, JavaScript and arbitrary iframes not part of Huwise context are not allowed in Huwise pages. Third-party embeds in JavaScript are therefore not supported." ([2255426](https://userguide.huwise.com/en/articles/2255426), edited 2026-01-28). Separately, the platform's `$sceDelegateProvider.resourceUrlWhitelist` only allows `self`, YouTube and Vimeo embeds, `platform.twitter.com/widgets.js` and veed.io. The portal's CSP `frame-src` lists more embed hosts (Power BI, Tableau, ArcGIS, Google Maps …). Both come from the live page and response headers.

**Observed on save.** I compared the local `page_examples/*/index.html` with the live `blocks.html` of the same Page (Beherbergungsstatistik, Mittelverwendung, Finanzkennzahlen):

- All HTML comments are removed (7, 4 and 39 respectively → 0).
- Attributes are re-ordered alphabetically and every value is quoted (`ods-analysis-serie-total=SUM(...)` → `="SUM(...)"`).
- Void elements are self-closed (`<br>` → `<br/>`, `<hr>` → `<hr/>`).
- `<` and `>` inside attribute values are entity-encoded (`&lt;`). They decode back before Angular reads them, so expressions with comparisons still work.
- Attribute and tag inventories are otherwise **identical**. No `ods-*`, `ng-*`, `style`, `target`, `rel`, `href`, `src` or `img` was lost.

This is consistent with an html5lib-style allowlist sanitiser. That is an inference; Huwise does not name it.

**Survives (seen in 13 live Pages).** `div, section, p, span, strong, i, a, img, h1–h4, hr, br, ul, li, table/thead/tbody/tr/th/td, label, button`; all `ods-*` tags and attributes; `ng-if, ng-show, ng-class, ng-style, ng-click, ng-init, ng-repeat, ng-bind, ng-bind-html, ng-href, ng-src, ng-switch`; inline `style`, `target`, `rel`.

**Not determinable from outside.** None of the live Pages contains `<script>`, `on*=` handlers, `<iframe>`, `<svg>`, `<style>` inside the HTML, `<input>`, `<select>` or `<form>`. Sanitisation happens server-side on save, so whether each of these is stripped, escaped or rejected is unknown. The only way to pin it down is to paste a probe Page into the editor and read back its stored `blocks.html`. A second layer applies at render time: `ng-bind-html` goes through `ngSanitize`.

**Practical rule for the generator.** Emit only plain HTML, Widgets, and Angular directives and expressions, and treat Angular expressions as the only "scripting" available. This is what all Example Pages do.

## 3. Embedding / framing (input for #9)

- `GET https://data.gr.ch/` returns 302 → `/pages/homepage/` **with** `X-Frame-Options: DENY` and `frame-ancestors 'none'`.
- The **200 responses** for `/pages/<slug>/`, with or without `?headless=true`, carry **neither** header. Content Pages are frameable.
- The Sharing tab produces iframe code ([Legacy: Sharing and embedding a content page](https://userguide.huwise.com/en/articles/2255618), edited 2026-07-01).
- Restricted Pages and datasets render text but no Visualizations for viewers without access ([Legacy: Managing a page's security](https://userguide.huwise.com/en/articles/2255298)). Several Example Pages are `visibility: restricted` in `assets-listing`.
- Maps hidden at init (`ng-show`, inactive `ods-tabs` pane) render grey tiles. Use `ng-if` or `pane-auto-unload="true"` ([How to troubleshoot maps…](https://userguide.huwise.com/en/articles/2255682), edited 2026-10-05).

## 4. Can it be reproduced locally?

### Network facts

Checked with `curl -H 'Origin: http://localhost:8000'`:

| Endpoint | CORS |
|---|---|
| `/api/explore/v2.1/catalog/datasets/<id>/records`, `/exports/geojson` | `access-control-allow-origin: *` |
| `/api/records/1.0/search/`, `/api/records/1.0/analyze/`, `/api/datasets/1.0/<id>/` (used by most v1 widgets) | `*` |
| Preflight with `ODS-API-Analytics-App` header | allowed (`access-control-allow-headers` includes `ODS-API-Analytics-App`, `ODS-Widgets-Version`) |
| `Origin: null` (file://) | `*` |
| `/assets/theme_font/EudoxusSans-*.woff` | `*` (so cross-origin `@font-face` works) |
| `/css/…`, `/static/vendor/…` JS | no ACAO header. Not needed: loaded via `<link>` / `<script>` |
| `/explore/dataset/<id>/download/` | no ACAO header. Widgets only use it as a link `href` (`ods-widgets.js:11220`), so it is not a problem |

- **Rate limit:** responses carry `x-ratelimit-limit: 5000` per day for anonymous use. One Page can issue dozens of requests (Beherbergungsstatistik alone has 21 `ods-results`), so repeated renders consume the budget.
- **jawg basemap tiles** load with any or no Referer, using either the domain key or the library default `opendatasoft-community`.
- Highcharts 11.1.0 from `code.highcharts.com` returned 403 for a bare curl and 200 with a browser User-Agent.

### Feasibility check (throwaway, not committed)

A single HTML file was served from scratch space with `python3 -m http.server` and rendered with Playwright's `chrome-headless-shell` (`--screenshot --virtual-time-budget=25000`). It wrapped the local Beherbergungsstatistik `index.html` and `stylesheet.css`. The result, compared with a screenshot of the live `?headless=true&flg=de-ch` Page at the same viewport (1280×1400):

- **Same:** header card, fonts, colours, map extent, choropleth colouring from live data, legend values with Swiss formatting (`100'182`).
- **Different:**
  - The legend's no-data label read "No value" instead of "Kein Wert", because no German gettext strings were loaded.
  - The layer switcher was missing, because only one basemap was configured.
  - The "Bereitgestellt von Huwise" attribution was missing.
  - The console logged `Unknown provider: currentLanguageFilterProvider` for the footer's `'de'|currentLanguage`.

### What a harness needs

1. **Shell markup** identical to the platform: `<main class="main--page"><div ng-app=… ng-controller="PageController"><div class="page-layout ng-cloak"><style>CSS</style><div>HTML</div></div></div></main>`. Inject the HTML either before bootstrap or via `$compile` against the controller scope, to mimic `odsBindAngularContent`.
2. **Scripts, in order:**
   - jQuery 3.7.0
   - AngularJS 1.8.3 and angular-sanitize 1.8.3
   - `https://data.gr.ch/static/vendor/angular-1.8.3/i18n/angular-locale_de-ch.js`
   - ods-widgets 2.1.2: local `dist/`, with `basePath` pointing at it so `libs/` lazy-loads
   - `https://data.gr.ch/static/vendor/moment-2.29.4/locale/de-ch.js`, then `moment.locale('de-ch')`
3. **Stylesheets** taken from data.gr.ch: font-awesome 4.7.0, normalize, `odsui.css`, `front-angular.css?<rev>`, theme `stylesheet/<rev>.css`, and the Eudoxus `@font-face` rules rewritten to absolute URLs. Use `front-angular.css` **instead of** the library's `ods-widgets.css`. Scrape `<rev>` (currently 44) from a live Page rather than hard-coding it.
4. **`ODSWidgetsConfigProvider.setConfig`** copied from a live Page, with `defaultDomain: 'https://data.gr.ch'` added. That is the one key that must differ, so that relative API calls hit the portal. Also keep `chartColors`, `basemaps`, `neutralBasemap`, `defaultMapLocation`, `language: 'de'`, `mapPrependAttribution`, `themes`. Optionally set `customAPIHeaders` to tag harness traffic.
5. **`ModuleLazyLoaderProvider.getConfig()` overrides** pointing Highcharts at `https://data.gr.ch/static/vendor/highcharts/…` (6.1.4 + `highcharts-i18n/de-ch.js`, more, treemap, funnel) and Leaflet at `/static/vendor/leaflet/`, mirroring the platform's override. Without this the library loads Highcharts **11.1.0**. Its DOM and defaults differ, and Example Page CSS targets Highcharts internals (`g.highcharts-legend-item rect`, `.highcharts-tooltip-container`, `.ods-highcharts__tooltip`).
6. **German widget strings:** copy the `gettextCatalog.setStrings('de', …)` object from a live Page.
7. **Stubs for platform-only pieces** a Page may use:
   - the `PageController` scope fields (`pageId`, `user.is_authenticated`, `domain.current_language`)
   - the `currentLanguage` filter (returns `lang === 'de'`)
   - optionally a guard that fails verification when any other platform-only directive or filter appears

The simplest way to get items 2–7 exactly right is to **scrape a live data.gr.ch Page**: take its `<head>` links and inline config scripts, then swap in the generated `blocks`. The alternative is maintaining a hand-written copy.

### What would still differ from the real thing

- **Sanitisation on save is not reproduced.** Comments are kept and anything forbidden still runs. The harness should lint for `<script>`, `on*`, `<iframe>`, etc. itself, since it cannot rely on Huwise behaviour it cannot observe.
- **Platform-only Widgets and filters** do not exist unless stubbed. The generator should avoid them anyway.
- **No portal chrome.** Without it, portal header and footer styling collisions from global CSS (e.g. `body {…}`) are invisible. Rendering against the `?headless=true` structure matches the iframe embed case.
- **Anonymous access only.** Restricted datasets return no data.
- **Rate limit.** Requests count against the anonymous 5000/day limit.
- **Version drift.** The data.gr.ch bundle names, theme revision and vendor versions change with Huwise releases. A scrape-based harness tracks this; a hard-coded one rots.

## Side findings

- **Local `page_examples/Mittelverwendung im Bereich Landeslotterie/stylesheet.css` is corrupted.** It contains formatted Page HTML, including `< !--` comments, after the CSS. The live CSS (`blocks.css`, 5,124 chars) is clean.
- **Example Page sources can be re-exported automatically.** Each one can be pulled from its live URL (`$scope.blocks` JSON, per language via `?flg=`), which would refresh `page_examples/`.
- The live Mittelverwendung Page's stripped comments mention "Layout 1b" and were evidently machine-written. It was published 2026-07-20.

## Sources

- Live Pages (fetched 2026-10-16): `https://data.gr.ch/pages/{dvs_awt_econ_202502032, mittelverwendung-im-bereich-landeslotterie, finanzkennzahlen-der-buendner-gemeinden, dashboard-ueberbauungsstand, dvs_awt_educ_202510020, referenztarife-fuer-ausserkantonale-stationaere-spitalleistungen, dvs_awt_econ_20260126, dvs_awt_educ_202512010, dashboard-tourismus-herkunftslaender, zweitwohnungsanteil, arbeitsmarkt_seit_1993, publikationskalender-daten-und-statistik, homepage}/?flg=de-ch`
- Platform bundles: `/static/compressed/js/output.bce6781d8d14.js` (`ods.core`, `odsBindAngularContent`), `output.1185628e843d.js` (ods-widgets 2.1.2), `output.ebb7fb5cf398.js` (jQuery 3.7.0), `/css/front-angular.css?44`
- Asset index: `https://data.gr.ch/api/explore/v2.1/catalog/datasets/assets-listing/records`
- Huwise user guide: [Creating Code editor pages](https://userguide.huwise.com/en/articles/2255490), [Content pages: ideas, tips & resources](https://userguide.huwise.com/en/articles/2255426), [Legacy: Sharing and embedding a content page](https://userguide.huwise.com/en/articles/2255618), [Legacy: Managing a page's security](https://userguide.huwise.com/en/articles/2255298), [How to troubleshoot maps that are not loading correctly](https://userguide.huwise.com/en/articles/2255682)
- Local library (gitignored, owner's checkout): `ods-widgets/README.md` (setup, dependency order), `ods-widgets/CHANGELOG.md` (2.1.2), `ods-widgets/dist/ods-widgets.js` (`ODSWidgetsConfig` defaults ~l.9552, `getDomainURL` ~l.10074, `ModuleLazyLoader` ~l.14151), `ods-widgets/dist/libs/ods-map/ods-tilelayer.js` (jawg URLs)
- Local Example Pages: `page_examples/*/index.html`, `stylesheet.css`
