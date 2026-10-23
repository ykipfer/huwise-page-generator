# Pattern 8: Tabs

## Job

Let the reader switch between several Visualizations of the same data in the one large area: "Logiernächte", "Ankünfte", "Tabelle". Use it when the Visualizations answer related questions and one at a time is enough. **One Visualization per tab; the filters sit above the tabs** and apply to every tab. Hand-built tabs (`ng-click="tab = 'a'"` with `ng-if`) are banned (`banned-hand-built-tabs`).

## Widgets

- `ods-simple-tabs` > `ods-simple-tab` (`widgets/tabs.md`).
- The root element gets `hw-has-tabs`, which reserves the height of the tab bar (`--hw-tabs-h` plus 8px) in the budget. The areas inside the tabs (`hw-chart-area`, `hw-table-area`) then shrink by exactly that.
- The tab bar is the one the Widget generates (`ul.ods-simple-tabs-nav`). Its CI look comes from the Page CSS block below, which uses the base stylesheet's tokens. The base stylesheet's `hw-tabs` and `hw-tab` classes are the Widget-free stand-in for the Page Sketch only: a built Page styles the Widget's own nav and does not use them.

## Snippet

```html
<div class="hw-page hw-has-tabs">
  <ods-dataset-context context="{main_context}" {main_context}-dataset="{dataset_id}">
    <div class="hw-body hw-shape-single">
      <div class="hw-top">
        <div class="hw-kpis"><!-- KPI tiles, Pattern 5 --></div>
        <div class="hw-filters"><!-- filters, above the tabs --></div>
      </div>
      <div class="hw-card">
        <ods-simple-tabs>
          <ods-simple-tab label="{tab_label_one}">
            <div class="hw-chart-area"><!-- one chart, Pattern 6 --></div>
          </ods-simple-tab>
          <ods-simple-tab label="{tab_label_two}">
            <div class="hw-table-area"><!-- one table, Pattern 7 --></div>
          </ods-simple-tab>
        </ods-simple-tabs>
      </div>
    </div>
    <!-- footer, Pattern 15 -->
  </ods-dataset-context>
</div>
```

and in the Page's CSS, after the base stylesheet:

```css
.hw-page .ods-simple-tabs-container { margin: 0; }
.hw-page .ods-simple-tabs-nav {
  height: var(--hw-tabs-h);
  margin: 0 0 8px;
  border-bottom: 1px solid var(--hw-rule);
  overflow-y: hidden;
}
.hw-page .ods-simple-tabs-nav-link {
  height: 100%;
  padding: 0 16px;
  display: flex;
  align-items: center;
  font-weight: 700;
  color: var(--hw-muted);
}
.hw-page .ods-simple-tabs-nav-link:hover,
.hw-page .ods-simple-tabs-nav-link:focus { border-bottom-color: var(--hw-rule); }
.hw-page .ods-simple-tabs-nav-link.ods-simple-tabs-nav-link-active { color: var(--hw-brand); border-bottom-color: var(--hw-brand); }
```

Placeholders: `{tab_label_one}`, `{tab_label_two}` are short German labels (one or two words). Two to four tabs fit at 375px. The tabs must fit the Page width: the nav is not an allowed scroll container (`scroll-containers.json`), so a nav wider than the Page is reported as `overflow` at 375px.

The tabs card has no `hw-card-title`: the first tab's label is the title. If the card carries a title, the budget already reserves it (`--hw-card-head-h`).

## Pitfalls

- **Contexts declared outside the tabs** keep their data across switches. Put the context (and the filters that write into it) outside `ods-simple-tabs`, as in the snippet. A context declared inside a tab is rebuilt on every switch and forgets its filters.
- Each tab's content is destroyed on deselection and rebuilt on selection (`simple-tabs.js:103,126-127`). Leave `keep-content` off: maps need the rebuild to size correctly. A chart in a tab renders when its tab opens, so the render stage explores every tab as its own state and reports a Widget that never renders in any state (`widget-never-rendered`).
- A variable assigned inside one tab is not visible in another (child scope per tab, core.md "The scope rule").
- Do not read `simpleTabActive` to build your own tabs, and do not add an `ng-click` that switches a tab. Use the Widget (`banned-hand-built-tabs`).
- Two tab sets in one scope share `simpleTabActive` unless each has its own `sync-to-scope`. Pages use one tab set.
- The Widget's default tab bar has platform margins (`margin-bottom: 20px` on the nav, `1.5rem` on the container, `simple-tabs.less`) and padding that differ from what `hw-has-tabs` reserves. Always include the CSS block, or the budget no longer matches.
- One Visualization per tab. A tab with a chart and a table below it does not fit the area; split it into two tabs.
- Filters above the tabs must apply to all of them: every Visualization reads the same context. A filter that changes only one tab belongs in that tab, as a second context (and costs the budget a filter row there, which the base stylesheet does not provide: do not do it).
- Tabs are for the wide layouts and phones alike: below 720px the tab bar stays. Keep labels short so the bar fits without sideways scroll.

## Source Example Page

NASAK- und KASAK-Sportanlagen Katalog (`page_examples/NASAK- und KASAK-Sportanlagen Katalog/`) and Referenztarife für ausserkantonale, stationäre Spitalleistungen (`page_examples/Referenztarife für ausserkantonale, stationäre Spitalleistungen/`): `ods-simple-tabs`. Styling follows the AWT Design System (the base stylesheet), not those Pages' CSS.

Instance Page (verified on a real dataset): `patterns/instances/08-tabs/`, dataset `dvs_awt_econ_20250203` (Beherbergungsstatistik der Gemeinden), a text-search filter above three tabs (chart, chart, table). It passes `verify.mjs` clean at 375, 720 and 1200px with every tab explored.
