# Widget family: context

Widget: `ods-dataset-context`. Read `core.md` first: it holds the context rules (naming convention, scope, parameters).

Parameter tables were generated once from the ngdoc in the ods-widgets **source** (2.1.2, `ods-widgets/src/directives/`, never the stale `docs/` build) and are now maintained by hand. The verifier reads the first column of every table under a `## `ods-…`` heading: an attribute on a listed Widget that appears in none of its tables is reported as warning `undocumented-widget-attribute` (it never fails a Page). A parameter verified in the source but missing from the ngdoc goes into that Widget's "Real but undocumented" table, with its source line, and then stops warning. `<context>` and `<variablename>` in an attribute name stand for any name.

## `ods-dataset-context`

Element or attribute (`src/directives/dataset-context.js:6`). ngdoc: `src/directives/dataset-context.js:10`.

| Attribute | Type | Default | Description | ngdoc line |
|---|---|---|---|---|
| `context` | string |  | (mandatory) Name, or list of names separated by commas, of context(s) to declare. Context names must be in lowercase, can only contain alphanumerical characters, and cannot begin with a number, "data", or "x". | 13 |
| `<context>-dataset` | string |  | (mandatory) Identifier of the dataset(s) on which the context is based. | 14 |
| `<context>-domain` | string | `ODSWidgetsConfig.defaultDomain` | Domain where the dataset(s) can be found. Since the domain value is used to construct a URL to an API root, it can be: - an alphanumeric string (e.g., *mydomain*): it will assume that it is a Huwise domain (e.g., *mydomain.huwise.com*) - a hostname (e.g., *data.mydomain.com*) - a relative path (e.g., _/monitoring_): … | 15 |
| `<context>-apikey` | string | `none` | API key to use in every API call for the context (see Generating an API key). | 24 |
| `<context>-sort` | string | `none` | Sorts expression to apply by default to all widgets plugged to the declared context. The expression should be written using one of the following syntaxes: - `field` for an ascending order, - `-field` for a descending order. | 25 |
| `<context>-parameters` | object | `none` | Object holding parameters to apply to the context when it is created. Any parameter from the API can be used here (such as `q` or `refine.FIELD`). | 30 |
| `<context>-refresh-delay` | number | `none` | Number of milliseconds to wait before the context is automatically refreshed. If this parameter is not set, the context will not automatically refresh. The minimum delay is 10000ms. | 31 |
| `<context>-parameters-from-context` | string | `none` | Name of another declared context to replicate the parameters and queries from. Any modification on the parameters of this context or the original one will be applied to both. | 32 |
| `<context>-url-sync` | boolean | `none` | Enables the synchronization of the parameters to the page's parameters (query string). When sharing the page with parameters in the URL, the context will use them; and if the context parameters change, the URL parameters will change. Note: if this parameter is enabled, `parameters` and `parametersFromContext` won't … | 33 |

Real but undocumented (read in the source, absent from the ngdoc; no lint warning):

| Attribute | Type | Description | Source |
|---|---|---|---|
| `<context>-source` | string | Data source label passed to the context. | dataset-context.js:190 |
| `<context>-dataset-schema` | JSON | Inline dataset schema instead of a dataset ID. | dataset-context.js:196 |
| `<context>-urlsync` | boolean | The attribute the source actually reads. The ngdoc names it `url-sync` (see Correct usage). | dataset-context.js:220 |

## Correct usage

Every claim cites `ods-widgets/src/directives/<file>:<line>`; re-check them after a Huwise upgrade.

**`ods-dataset-context`**

- One element declares several contexts. Each name in `context` reads its own `<name>-…` attributes (`dataset-context.js:148-160`), so `<name>-dataset`, `<name>-parameters` etc. are the real attribute names. The ngdoc lists them without the prefix.
- Contradiction: the ngdoc names the sync parameter `url-sync`; the source reads `<name>-urlsync` (`dataset-context.js:220`). The Page rules never use URL sync, so avoid both.
- The dataset ID must match `[a-z0-9@_-]` only; anything else is logged and replaced by an empty ID, which leaves the context without data (`dataset-context.js:163-166`).
- `<name>-parameters` is evaluated as an expression (`$scope.$eval`, `dataset-context.js:213`) once, when the context is created, so literals and already-available variables work. Wait for data with `ng-if` on the element instead of expecting the parameters to update.
- `<name>-sort` is copied into `parameters.sort` (`dataset-context.js:184-186,216-218`); setting both is redundant.
- `<name>-domain` and `<name>-apikey` are interpolated, but a Page never sets them (`domain-attribute` is a lint error): the Page's own portal serves every dataset it uses (`dataset-context.js:172-181`).
- The element has `scope: true` and `replace: true` (`dataset-context.js:145-146`). Widgets inside it share that child scope; a variable assigned inside does not reach the parent (core.md, "The scope rule").
- `<name>-refresh-delay` below 10000 ms falls back to 10000 (`dataset-context.js:202-210`); Pages don't poll.
