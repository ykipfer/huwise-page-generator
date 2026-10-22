# Widget family: filter

Widgets: `ods-select`, `ods-text-search`. Both write into a context's parameters. Read `core.md` first.

Parameter tables were generated once from the ngdoc in the ods-widgets **source** (2.1.2, `ods-widgets/src/directives/`, never the stale `docs/` build) and are now maintained by hand. The verifier reads the first column of every table under a `## `ods-…`` heading: an attribute on a listed Widget that appears in none of its tables is reported as warning `undocumented-widget-attribute` (it never fails a Page). A parameter verified in the source but missing from the ngdoc goes into that Widget's "Real but undocumented" table, with its source line, and then stops warning. `<context>` and `<variablename>` in an attribute name stand for any name.

## `ods-select`

Element (`src/directives/select.js:66`). ngdoc: `src/directives/select.js:69`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `options` | array |  | The input array of value which feeds the list of options | 72 |
| `selected-values` | array |  | The variable name to use to store the selected options' values | 73 |
| `label-modifier` | expression | `none` | An expression to apply on the options' label | 74 |
| `value-modifier` | expression | `none` | An expression to apply on the options' value. This parameter is used to modify the form of the values exposed by `selected-value`. | 75 |
| `on-change` | expression | `none` | An expression to evaluate whenever an option has been (de)selected | 76 |
| `multiple` | boolean | `false` | When set to `true`, the menu will support multiple selections. | 77 |
| `is-loading` | boolean | `false` | Specifies whether the widget should initially display a loader. This parameter will be automatically set to `false` as soon as options are loaded. | 78 |
| `disabled` | boolean | `false` | Specifies whether the widget should be disabled. | 79 |
| `placeholder` | string | `"Select one or more elements" or "Select one element"` | Specifies a short hint that describes the expected value of the select field. | 80 |

## `ods-text-search`

Element (`src/directives/text-search.js:5`). ngdoc: `src/directives/text-search.js:8`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `context` | CatalogContext\|DatasetContext\|CatalogContext[]\|DatasetContext[] |  | (mandatory) Catalog Context, Dataset Context, or array of context to use | 11 |
| `placeholder` | string | `none` | Text to display as a placeholder when the search box is empty | 12 |
| `field` | string | `none` | Name of a field the search will be restricted on (i.e., the widget will only allow to search on the textual content of the chosen field). If more than one context is declared, it is possible to specify different fields depending on these contexts, using the following syntax: mycontext-field. If a specific field is not … | 13 |
| `suffix` | string | `none` | Changes the default `q` query parameter into `q.suffixValue`. This parameter prevents widgets from overriding one another, for instance when multiple odsTextSearch widgets are used on the same page. | 15 |
| `autofocus` | string |  | Makes the search box automatically selected at loading of the page to start typing the search without selecting the search box manually beforehand. No value is required for this parameter to function. | 16 |
| `id` | string |  | Adds an `id` attribute to the search's text box, for example, to integrate the widget to a clickable label. | 17 |

## Correct usage

Every claim cites `ods-widgets/src/directives/<file>:<line>`; re-check them after a Huwise upgrade.

**`ods-select`**

- The tag is replaced by `div.odswidget-select` (`replace: true`, `select.js:231,244`).
- `selected-values` is an expression bound two-way (`=`, `select.js:234`) and always holds an **array** once the user picks something (`select.js:479`). An initial scalar is wrapped into an array (`select.js:379-380`). The context parameter `refine.<field>` is therefore an array after a selection, which the API accepts. Read it as `([].concat(x))[0]` (core.md).
- Single select (the default) keeps one value: `multiple` is coerced to a boolean (`select.js:375`) and a new pick clears the others (`select.js:467-469`). `multiple="false"` and `multiple="true"` are expressions, not strings.
- `options` can be strings or objects. For objects set `label-modifier` and `value-modifier`, e.g. `label-modifier="name" value-modifier="name"` for the entries of `ods-facet-results` (ngdoc `valueModifier`, `select.js:74-75`).
- `on-change` is evaluated in the **parent** scope, after a `$timeout` (`select.js:437-439`), so the bound `selected-values` has propagated when the handler runs. The editor allows `on-change` on this element (lint accepts `on*` on `ods-*` tags).
- `options` and `selected-values` are two-way bindings evaluated in the surrounding scope (`select.js:233-234`), so nest the Widget inside the element that defines `options` (core.md, "The scope rule").

**`ods-text-search`**

- The tag is replaced by `div.odswidget.odswidget-text-search` (`replace: true`, `text-search.js:56-57`). The `id` attribute is moved to the inner input and removed from the root (`text-search.js:60,90`).
- It writes the **`q`** context parameter (`text-search.js:235,238`). This is the one allowed use of `q`: the lint bans `'q'` only when written into `*-parameters` as a filter. With `field`, it writes `field:"text"` (`text-search.js:235`). `suffix` changes the key to `q.<suffix>` so several boxes don't overwrite each other (`text-search.js:157`).
- Resetting deletes the parameter (`text-search.js:223`).
- `context` accepts an array: `context="[a, b]"`; use `<name>-field` per context (`text-search.js:131`).
- Contradiction: the scope also binds `button` (`text-search.js:78`); it is unused by the template. Don't set it.
- The widget's template contains a `<form>` (`text-search.js:59`). That is runtime markup, not your Page's HTML, so the editor's `<form>` refusal does not apply; never write a `<form>` yourself.
