# How Huwise Pages behave when embedded via iframe

Research for [#6](https://github.com/ykipfer/huwise_page_generator/issues/6), part of the map [#1](https://github.com/ykipfer/huwise_page_generator/issues/1).
Live checks were run against data.gr.ch on 2026-10-16.

## Answer

A **Page** on data.gr.ch can be framed from any origin. Embed it as `https://data.gr.ch/pages/<slug>/?headless=true` (Huwise staff now give `/page/<slug>/?headless=true`, which behaves the same). `headless=true` removes the portal header, navigation and footer on the server. An appended `/embed/` does nothing.

The embedding site sets the iframe's size, and the iframe works as a **fixed-size viewport**. Huwise has no mechanism that syncs the iframe height to its content, so nothing grows the iframe to fit the Page.

Widgets size themselves against the **iframe's** window, not the host page. Media queries and Bootstrap `col-*` classes respond to the iframe width. Charts reflow automatically. Maps follow window resizes, and `auto-resize` fills the map down to the bottom of the iframe.

As a result, host-side height syncing is **not required** as long as the Page is designed for a known iframe height, which is what every Example Page does. It is also **not offered**: building it would mean a custom `postMessage` script on both sides. It would also clash with `auto-resize`, as described below.

## 1. Framing: is embedding allowed?

| URL (fetched 2026-10-16) | Status | `X-Frame-Options` | CSP `frame-ancestors` |
|---|---|---|---|
| `https://data.gr.ch/` | 302 → `/pages/homepage/` | `DENY` | `'none'` |
| `https://data.gr.ch/pages/homepage/` | 200 | absent | absent (no CSP header at all) |
| `https://data.gr.ch/pages/homepage/?headless=true` | 200 | absent | absent (CSP has `frame-src`, no `frame-ancestors`) |
| `https://data.gr.ch/page/homepage/?headless=true` | 200 | absent | absent |

Check used: `curl -sI <url> | grep -ci x-frame-options` and `… | grep -ci frame-ancestors`. Both return `0` for every Page URL.

**Pitfall:** only the root redirect carries `DENY` / `frame-ancestors 'none'`. Running curl against `https://data.gr.ch/` alone wrongly suggests the portal blocks embedding. Page URLs can be framed.

The response also sends `Permissions-Policy: …fullscreen=(self)…`, so a framed Page cannot go fullscreen unless the host grants it (see §4.1).

Access control still applies. The Huwise user guide says "Sharing and/or embedding a content page depends on the security configured for both the workspace and the page itself" ([Sharing and embedding a content page](https://userguide.huwise.com/en/articles/2255618)). A Page has to be public before it can be embedded for anonymous visitors.

## 2. Which URL removes header, footer and navigation

- **`?headless=true`** is the switch. A Huwise team member recommended it on the official community forum: "You can use the parameter "headless=true" in the URL, for example https://data.bl.ch/p/wahlen_nr_sr/?headless=true" ([community thread](https://community.huwise.com/share-data-71/embedd-dashboards-in-iframes-without-ods-header-265), July 2024). It is not in the user guide.
- **Verified on data.gr.ch:**
  - `/pages/homepage/` returns 88,698 bytes and `?headless=true` returns 55,072 bytes. In the headless response the `<header role="banner">` and `<footer id="footer">` elements are empty, and the React header/navigation bundle is not loaded.
  - The headless page sets `appendedURLQuerystring: "headless=true"` in its config, and the portal JS appends `&headless=` to its internal search links (`output.bce6781d8d14.js`). Navigating inside the frame therefore usually stays headless.
- **`/embed/` suffix on a Page is a no-op.** `/pages/homepage/embed/` returns a body byte-identical to `/pages/homepage/` (same MD5). The `/embed/` endpoint exists only for dataset visualizations, as the community thread notes ("for a table … the /embed/ endpoint").
- **Avoid `/explore/assets/<slug>/view?headless=true`.** This newer "funnel" display still injects `#ods-code-editor-funnel-root` around the Page. Huwise staff confirmed it adds an extra element and pointed to `/page/<slug>?headless=true` as the way to get the previous behaviour, adding: "as long as code editor pages remain available, we have no reason to change the way this works" ([same thread](https://community.huwise.com/share-data-71/embedd-dashboards-in-iframes-without-ods-header-265), Aug 2026).
- **Route choice:** `/pages/<slug>/` (the form data.gr.ch's own navigation uses) and `/page/<slug>/` both return 200 and produce the same headless markup today. `/p/<slug>/` returns 404 on data.gr.ch.

**The Sharing tab's iframe snippet.** The user guide says only: "Choose the size of the page from the drop-down list. Click on the copy button to copy the iframe code." The preset sizes are not documented ([user guide](https://userguide.huwise.com/en/articles/2255618)). They also do not appear in the public front-office JS bundles, which contain only YouTube/Vimeo/Dailymotion iframe templates. Reading the presets requires the back-office Sharing tab. Whatever the preset, the snippet hard-codes a `width`/`height` on the iframe, and the host page owns those values.

## 3. Host-side height syncing: offered or needed?

- **Not offered.** The headless Page's scripts contain no iframe-resizer code. The only `postMessage` calls in the front-office bundle (`output.1185628e843d.js`) send `EMBED_TOKEN` / `TOKEN_REFRESH` messages *down* into the Huwise agents chat widget. Nothing reports the Page's height *up* to a parent.
- **Not needed** if the Page fits a known iframe height. None of the Example Pages contains any `<script>`, `postMessage` or iframe code (grep over all `page_examples/*/index.html` and `stylesheet.css`). They size their Visualizations with fixed heights (§5).
- **Risky if added.** Combining host auto-height with `ods-map auto-resize` creates a feedback loop (§4.1), so a Page meant for auto-height must not use `auto-resize`. The map's "Out of scope" entry for host-side auto-height can stay as it is.

## 4. How Widgets respond inside the iframe

Inside an iframe, `window` is the iframe's own window. `$(window).height()` and `vh` refer to the iframe height, and `vw` and media queries refer to the iframe width. When the host changes the iframe element's size, a `resize` event fires on the iframe's window.

Source paths below point to the gitignored local checkout and are given as absolute paths. The portal serves the same code: the front-office bundle contains the identical `Math.max(200, …)` resize expressions and the `window.self===window.top` fullscreen check, and it loads Leaflet 0.7.3 and Highcharts 11.1.0 like the local source.

### 4.1 `ods-map`

- **Default size.** `.odswidget-map { min-height: 400px }` and `.odswidget-map__map { height: 100%; min-height: 400px }` (`/Users/kipfie/Documents/Claude OS/03_Code/huwise_page_generator/ods-widgets/src/less/components/map.less:1-21`). Without a sized parent, a map is 400px tall. At short iframe heights that floor wins over smaller containers unless it is overridden.
- **`auto-resize="true"`** (`…/ods-widgets/src/directives/map.js:244-258`):
  ```js
  var mapElement = jQuery('.odswidget-map__map');
  var height = Math.max(200, jQuery(window).height() - mapElement.offset().top);
  mapElement.height(height);
  ```
  The map runs this on init and on every window `resize`. Inside an iframe the map fills from its top edge down to the **bottom of the iframe**, with a minimum of 200px. Consequences:
  - Content placed below an auto-resized map always sits below the iframe's fold and needs scrolling.
  - The selector is global (`.odswidget-map__map`). With several maps on one Page, the first map's offset sets the height of all of them.
  - **Feedback loop with host auto-height:** if the host grows the iframe to the document height, the map grows by the height of the content below it, which grows the document, and so on. Don't combine the two.
  - In a hidden tab or other undisplayed container, `offset().top` is meaningless at init. `ods-simple-tabs` avoids this by building the tab content only after it becomes visible (next bullet).
  - The generic `ods-auto-resize` attribute directive does the same calculation with a 50ms debounce (`…/ods-widgets/src/directives/auto-resize.js:32-45`). Its doc says it "forces the affected element to fill the height to the bottom of the window".
- **Width changes.** Leaflet 0.7.3 (`…/ods-widgets/src/services/utils.js:22-24`) defaults to `trackResize: true`, which calls `invalidateSize` on window `resize` (leaflet-src.js 0.7.3, lines 1555 and 2186-2191). Resizing the iframe therefore re-lays out the map. A container that changes size without a window resize is not tracked; the Page would have to broadcast `invalidateMapSize` (`map.js:261-263`).
- **Fullscreen button is suppressed in iframes** (`…/ods-widgets/src/directives/map.js:359-373`): `toolbarFullscreen` only adds the control `if (window.self === window.top)`, with the comment "as it is blocked by browsers". Embedded maps have no fullscreen button.
- **Map display control** (`display-control="true"`, used by three Example Pages) is a 300px panel. Leaflet's top-right controls move 310px to the left to make room, and only collapse below `@screen-xs-max` (767px) (`map.less:194-202`). On narrow iframes this panel takes most of the map width.
- **Scroll trapping.** `scroll-wheel-zoom` defaults to `true` (`map.js:55`), so a map captures page scrolling. Dashboard Überbauungsstand sets `scroll-wheel-zoom="false"`. This matters more inside an iframe, because the host page's scrolling stalls on the map.

### 4.2 `ods-chart` (Highcharts)

- Charts use Highcharts 11.1.0 (`…/ods-widgets/src/services/utils.js:12-19`; the portal bundle loads the same version).
- **Reflow is automatic, for width and height.** `chart.reflow` defaults to `true` (highcharts.src.js 11.1.0, line 2965). `setReflow()` attaches a `ResizeObserver` to the chart container, falling back to window `resize` (lines 36198-36213). Charts therefore follow both iframe resizes and container-only changes.
- **Height.** "By default (when `null`) the height is calculated from the offset height of the containing element, or 400 pixels if the containing element's height is 0" ([Highcharts API: chart.height](https://api.highcharts.com/highcharts/chart.height)). ods-widgets sets `.ods-chart { height: 100%; min-height: 200px }` with `.chartplaceholder { width: 100%; height: 100% }` (`…/ods-widgets/src/less/components/chart.less:1-9`). An `ods-chart` in an unsized parent renders at 400px. To control the height, give the parent a fixed height and set `ods-chart { display: block; height: 100% }`, as Finanzkennzahlen and Referenztarife do.
- **Small widths.** Highcharts shrinks the plot. Long category labels and legends get cramped. Dashboard Überbauungsstand gives the chart container `overflow-x: auto` so wide bar plots scroll horizontally instead of being crushed.

### 4.3 `ods-simple-tabs`

By default an `ods-simple-tab` destroys its content on deselection and rebuilds it on selection, behaving like `ng-if`. The source explains why: "the selection triggers the display: block in the CSS; if we run the content at the same time, it may be run before it is truly displayed in the page, which can cause issues with Leaflet for example (it needs to know where it is in the page when it is initialized)" (`…/ods-widgets/src/directives/simple-tabs.js:72-118`). If `keep-content="true"` is set, maps in hidden tabs initialise at zero size and need `invalidateMapSize`. Four Example Pages use `ods-simple-tabs` with the default behaviour.

### 4.4 Tables

`ods-advanced-table` watches its wrapper with `ResizeObserver` (`…/ods-widgets/src/directives/advanced-table.js:653-690`). The Example Pages mostly build HTML tables themselves inside `#htmlTable { overflow-x: auto }` (and `overflow-y: auto` inside fixed-height tab panels). Wide tables scroll inside the iframe instead of overflowing it.

## 5. How the Example Pages handle size and responsiveness

All paths are under `/Users/kipfie/Documents/Claude OS/03_Code/huwise_page_generator/page_examples/`.

| Example Page | Map sizing | Chart sizing | Breakpoints |
|---|---|---|---|
| Beherbergungsstatistik der Gemeinden | `auto-resize="true"` | n/a | 768, 480 px |
| Finanzkennzahlen der Bündner Gemeinden | `auto-resize="true"` inside tabs; `.map-loading-container { min-height: 500px }` | `ods-chart { display:block; height:100% }` in a fixed-height box | 600, 1000 px |
| Dashboard Überbauungsstand | default (400px floor), `scroll-wheel-zoom="false"` | `overflow-x: auto` on the bar-plot container; Bootstrap `col-md-*` grid | none |
| Verzeichnis von Schneesportschulen … | tab wrapper `height: 600px` → 500px (≤768) → 400px (≤480); map `height:100% !important` | n/a | 768, 480 px |
| NASAK- und KASAK-Sportanlagen Katalog | same pattern as Verzeichnis | n/a | 768, 480 px |
| Tourismusdestinationen im Kanton Graubünden | tab wrapper fixed `height: 600px` | n/a | 600, 1000 px |
| Referenztarife … Spitalleistungen | n/a | `ods-chart { height:100% }` in a sized box | 1000 px |
| Mittelverwendung im Bereich Landeslotterie | n/a | unknown: the local `stylesheet.css` contains a minified copy of the HTML, not CSS | unknown |

Patterns:

- The dominant pattern is a **fixed-height wrapper that steps down at 768/480px**, with the Widget set to `height: 100%`. `auto-resize` is the minority pattern.
- Layout uses CSS grid with `repeat(auto-fit, minmax(280px, 1fr))` (NASAK, Verzeichnis), flex-wrap rows (Überbauungsstand), and `max-width: 1200px` content wrappers. Below 768px or 1000px these collapse to one column.
- Wide content gets an `overflow-x: auto` wrapper.
- Map tooltips are capped with `max-width: calc(100vw - 40px)` or 340/300px at the breakpoints. Inside an iframe, `100vw` is the iframe width, which is the right reference.
- No Example Page contains scripts, `postMessage`, or iframe-specific code.

## 6. Constraints a responsive Page must respect

1. Embed with `/pages/<slug>/?headless=true` (or `/page/<slug>/?headless=true`). Do not use `/embed/` or `/explore/assets/<slug>/view`.
2. Treat the iframe as a fixed viewport. Every media query, `vw`/`vh` and Bootstrap breakpoint refers to the iframe, not the host page.
3. Give every map and chart a parent with an explicit height. Otherwise maps render at 400px (CSS floor) and charts at 400px (Highcharts fallback). To go below 400px, override `.odswidget-map` / `.odswidget-map__map` `min-height`.
4. Use `auto-resize="true"` only for a single map that should fill the rest of the iframe with nothing below it. Never use it with several maps on one Page, and never together with host-side auto-height.
5. Expect no fullscreen button on embedded maps. Consider `scroll-wheel-zoom="false"` so the map doesn't trap the host page's scrolling.
6. Charts reflow automatically. For narrow widths, plan label length and legend placement, or allow `overflow-x: auto`.
7. Keep `ods-simple-tabs` on the default (rebuild on select) when tabs contain maps.
8. `display-control="true"` costs 300px of map width. Use it carefully on narrow iframes.
9. The Page must be public under both the workspace and Page security settings before anonymous visitors can see it embedded.

## Open points / not verified

- The Sharing-tab size presets are undocumented and absent from the public JS. They can only be read in the back office.
- The local Example Page "Mittelverwendung im Bereich Landeslotterie" has no usable CSS: its `stylesheet.css` holds HTML. Its header comment calls it a "kompaktes Embed-Dashboard (Layout 1b)".
- The headless check ran on a Page reachable without login (`/pages/homepage/`). No Example Page slug appears in the public sitemap or navigation (the sitemap lists only dataset assets), so no Example Page was checked live. The behaviour is portal-wide, so it should carry over.
- Widget behaviour was established from source code, not by rendering a Page in an iframe in a browser. Any automated verification should render the Page **inside an iframe** at a few widths and heights (for example 375×600, 768×700, 1200×800). A bare full-window render hides iframe-only differences: the missing fullscreen button, `auto-resize` measured against the iframe height, and the 400px floors.
