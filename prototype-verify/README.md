# PROTOTYPE: Page verification (throwaway)

Answers [How does the generator verify a Page?](https://github.com/ykipfer/huwise_page_generator/issues/9). Lives only on the `prototype/page-verification` branch and is never merged.

**Branch assumption.** This question is about a pipeline, not about a state model or a look, so it fits neither the LOGIC nor the UI branch of the prototype skill. The prototype is a CLI that prints a report.

## Run

```sh
cd prototype-verify && npm install          # playwright 1.61.0 (matches the cached chromium-1228)
node verify.mjs fixtures/mittelverwendung   # or any dir with index.html + stylesheet.css
node verify.mjs <dir> --sizes 375x600,1200x800
```

Needs the gitignored `../ods-widgets/` checkout (served as the public library 2.1.2). Writes `out/<page>/report.md`, `report.json` and PNGs. The exit code is 1 on any error.

## Pipeline

| Step | Cost | Signals |
|---|---|---|
| 1. **Scrape** live config from one data.gr.ch Page (cached 1 day) | 1 page fetch | `ODSWidgetsConfig`, gettext `de` strings, Highcharts 6.1.4 / Leaflet lazy-loader overrides, stylesheet links, theme rev |
| 2. **Lint** (DOMParser, no network) | 0 | Widget outside the closed list of 18 · attribute not in the `ods-widgets/src` ngdoc (**warning**) · banned habits (`$root.shared`, `range-custom`, `q:`, hard-coded year, `ods-results`+`ng-repeat` without max, hand-built tabs via `ng-click`) · side effects outside the two allowed forms · `<script>`/`on*`/`<iframe>` · platform-only `currentLanguage`, `.ods-box`, `svelte-*` |
| 3. **Dataset dry-run** (v2.1 API; the skill would use the MCP) | 1 per dataset + 1 per literal `ods-adv-analysis` + 1 per `category-colors` | referenced fields exist · literal ODSQL runs and returns rows · `category-colors` keys = real values of `series-breakdown` |
| 4. **Render** in an `<iframe>` at 375×600, 768×700, 1200×800; click each author-written `ng-click` and each `ods-simple-tabs` tab | ~9 API requests per size | console errors / uncaught · API 4xx with message · Widget variable never set / empty / NaN · chart without points · map without features or < 400 px · `{{`, `NaN`, `undefined` in visible text · horizontal overflow + offenders · Widget never rendered in any explored state · content height vs iframe height (info) |

Settling means no in-flight requests for 1.5 s and no visible spinner or `ng-cloak` (30 s cap). Static portal files are proxied same-origin because Font Awesome has no CORS header.

## Results (2026-10-17)

| Fixture | Verdict | Time | API requests |
|---|---|---|---|
| `mittelverwendung` (live Page) | FAIL, 6 errors | 19 s | 29 |
| `mittelverwendung-broken` (8 seeded faults) | FAIL, 17 errors | ~20 s | 9 |
| `mittelverwendung-broken-iter2` (root cause removed) | FAIL, 21 errors | 20 s | 33 |

- **The live Example Page fails on real defects.** It has hand-built tabs (`ng-init`/`ng-click`), the platform-only `.ods-box`, and three `category-colors` keys (Umwelt, Bildung, Übrige) that match no `kategorie` value. Those three categories fall back to the default palette, so in the live chart "Jugend und Erziehung" and "Bildung und Forschung" share one blue.
- **Cascade.** A single platform-only filter (`currentLanguage`) throws `$injector:unpr` and blanks the whole Page. Render findings are then just "never rendered". Lint has to be clean before render findings mean anything.
- **Every seeded fault was caught**, at lint or dry-run, or at render after the root cause was removed. The exception is the fixed-width list: it sat inside an `overflow:hidden` card, so it was correctly *not* overflow. A scratch check with an unclipped 720 px element fired at 375 px only.
- **The prototype itself found two docs gaps.** `odsChartQuery` reads `context` (highcharts.js:2271), but the ngdoc doesn't document it. Replace-mode Widgets swap their tag for an `odswidget-*` root (`ods-chart` → `.odswidget-charts`).

## Known gaps

- `ng-repeat` over an out-of-scope variable renders zero items silently (scope-rule errors). There is no check for "repeat produced nothing".
- Overflow offenders include cells inside a horizontally scrolling container, which is noise.
- Line numbers are the first textual match, so they are approximate.
- No map on this Page: the map checks (features, 400 px floor) never ran.
- `ods-select` options are not exercised as states, so only the initial filter value is verified.
- Fidelity: the save-time sanitiser isn't reproduced (lint stands in for it), and data is anonymous only.
