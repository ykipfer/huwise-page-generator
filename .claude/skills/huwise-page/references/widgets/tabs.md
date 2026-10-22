# Widget family: tabs

Widgets: `ods-simple-tabs` > `ods-simple-tab`. They only work nested, so they share this file.

Parameter tables were generated once from the ngdoc in the ods-widgets **source** (2.1.2, `ods-widgets/src/directives/`, never the stale `docs/` build) and are now maintained by hand. The verifier reads the first column of every table under a `## `ods-…`` heading: an attribute on a listed Widget that appears in none of its tables is reported as warning `undocumented-widget-attribute` (it never fails a Page). A parameter verified in the source but missing from the ngdoc goes into that Widget's "Real but undocumented" table, with its source line, and then stops warning. `<context>` and `<variablename>` in an attribute name stand for any name.

## `ods-simple-tabs`

Element (`src/directives/simple-tabs.js:5`). ngdoc: `src/directives/simple-tabs.js:8`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `sync-to-scope` | string | `'simpleTabActive'` | Name of parent scope variable to sync the current active tab | 14 |

## `ods-simple-tab`

Element (`src/directives/simple-tabs.js:74`). ngdoc: `src/directives/simple-tabs.js:77`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `label` | string |  | The label to be displayed in the tab | 81 |
| `fontawesome-class` | string |  | The Font Awesome icon name used for the tab, without the 'fa-' prefix | 82 |
| `keep-content` | boolean | `false` | By default, the widget destroys and rebuilds the pane content at deselection/selection. It acts like an ng-if when the panel is selected/deselected. When set to `true`, the widget does not destroy and rebuild the pane content at deselection/selection. | 83 |

Real but undocumented (read in the source, absent from the ngdoc; no lint warning):

| Attribute | Type | Description | Source |
|---|---|---|---|
| `slug` | string | Tab id; defaults to the slugified `label`. | simple-tabs.js:109 |

## Correct usage

Every claim cites `ods-widgets/src/directives/simple-tabs.js:<line>`; re-check them after a Huwise upgrade.

**`ods-simple-tabs`**

- The tag is replaced by `div.ods-simple-tabs-container` holding a `ul.ods-simple-tabs-nav` and the content (`replace: true`, `simple-tabs.js:19,26`).
- The first tab that registers is selected (`simple-tabs.js:63-67`).
- The selected tab's slug is written to `$scope.$parent[syncToScope]` (`simple-tabs.js:53,59`); the default name is `simpleTabActive`. Two tab sets in one scope share that variable unless each sets its own `sync-to-scope`. Don't read it to build your own tabs (`banned-hand-built-tabs`).

**`ods-simple-tab`**

- It needs an `ods-simple-tabs` ancestor (`require: ^odsSimpleTabs`, `simple-tabs.js:88`).
- `label` is the tab text and the source of the slug (`slugify`, `simple-tabs.js:109`); `slug` overrides it but is not in the ngdoc.
- The content is under `ng-if="visible || keepContent == true"` (`simple-tabs.js:103`). A tab becomes visible one digest after it is selected (`simple-tabs.js:121-124`) and is destroyed again on deselection (`simple-tabs.js:126-127`), unless `keep-content` is set. Leave it off for maps: they need the rebuild to size correctly. Contexts declared **outside** the tabs keep their data across switches.
- `keep-content` is an expression (`=?`, `simple-tabs.js:95`); only its presence together with a true value counts (`simple-tabs.js:110`).
- Each tab's content is a child scope (`ng-if`, `simple-tabs.js:103`). A variable assigned inside one tab is not visible in another (core.md, "The scope rule").
- `fontawesome-class` is the icon name without the `fa-` prefix (`simple-tabs.js:94`).
