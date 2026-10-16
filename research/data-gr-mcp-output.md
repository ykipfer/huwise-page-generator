# What the data.gr.ch MCP returns, and is it enough to plan Visualizations?

Research for ticket #4 (map #1). Probed on 2026-10-16.

**Source tags.** Each fact carries its source:

- **[MCP]**: a live call to the data.gr.ch MCP connector (`mcp__claude_ai_MCP-DATA-GR__*`).
- **[v2.1]**: the public Explore API, `https://data.gr.ch/api/explore/v2.1/...`, fetched with curl.
- **[v1]**: the public v1 API, `https://data.gr.ch/api/datasets/1.0/...` and `/api/records/1.0/...`, fetched with curl.
- **[widgets]**: the local `ods-widgets/src` source (gitignored, owner's checkout).
- **[pages]**: the local Example Pages in `page_examples/*/index.html` (gitignored).
- **[skill]**: the `ogd-graubuenden` skill at `~/.claude/skills/ogd-graubuenden/ogd-graubuenden/SKILL.md`.

## Answer

**Mostly yes.** The MCP gives an agent enough to plan Visualizations and to write correct field names, refine values and ODSQL aggregations for one data.gr.ch dataset. It has four gaps:

1. **The schema is thin.** `get_dataset` returns only `name`, `odsql_name`, `type` and `description` for each field. It leaves out these properties of the raw API:
   - field `label`
   - `annotations`, notably `timeserie_precision`
   - `semantic_type`
   - the dataset's `features` (`geo`, `analyze`, `timeserie`)

   The Widgets use `timeserie_precision` to decide which chart `timescale` values are valid.
2. **Facet lists stop at 100 values**, everywhere. `get_records` with `group_by` works around this.
3. **It cannot see datasets on other domains.** Two Example Pages draw their municipality geometry from `public.opendatasoft.com`.
4. **It cannot see which fields are facets.** Facet status shows only indirectly: the facets endpoint returns those fields and no others.

Gaps 1 and 4 are partly filled by one extra raw `GET /api/datasets/1.0/<id>/?lang=de` per dataset. That call returns German labels, annotations and features. It still shows no facet configuration (see the section on what the MCP leaves out).

## Setup in Claude Code

- The MCP is a **claude.ai account connector**, not repo config. The repo has no `.mcp.json`, and `.claude/` holds only worktrees. In Claude Code its tools appear as deferred tools named `mcp__claude_ai_MCP-DATA-GR__*`. Load them with `ToolSearch` (`select:mcp__claude_ai_MCP-DATA-GR__get_dataset,...`) before calling them.
- At session start the harness reported `MCP-DATA-GR (CONNECTION_CLOSED)`, yet every call after loading the tools succeeded. **The banner is unreliable.** Load the tools, call once, and retry once on failure. If it still fails, fall back to the Explore API and say so.
- The `ogd-graubuenden` skill already documents the MCP workflow and its pitfalls [skill]. It covers:
  - using `odsql_name`
  - checking values with facets, falling back to `group_by`
  - preferring `refine` over `where` for equality
  - "Total" rows that inflate `sum()`
  - `bfs_nummer` often typed `text`
  - putting the aggregate first in `order_by`

  A generator skill should reuse these rules, not restate them.

## What each tool returns

Tested on the datasets behind four Example Pages, plus their geo companion:

| Dataset | Example Page | records | Notes |
|---|---|---|---|
| `dfg_afg_econ_20260326` | Finanzkennzahlen der Bündner Gemeinden | 6150 | long format: `typ` = indicator, `betrag` = value |
| `dvs_awt_econ_20250203` | Beherbergungsstatistik der Gemeinden | 2682 | monthly, 40 municipalities |
| `dvs_are_soci_20250224` | Dashboard Überbauungsstand | 1467 | 9 facet fields |
| `ekud_ekud_econ_20260716` | Mittelverwendung im Bereich Landeslotterie | 15154 | |
| `dvs_awt_regi_202502110` | geometry for Beherbergung, Überbauungsstand, NASAK, Schneesportschulen | 100 | `geo_shape` and `geo_point_2d` |

### `get_dataset` [MCP]

Returns:

- `dataset_id`, `title` (German), `description` (long ones cut off with "..."; the full text is in `get_dataset_metadata`), `theme`, `keyword`, `publisher`, `modified`, `language`, `records_count`
- `fields[]`, each with `{name, odsql_name, type, description}`

Types seen: `text`, `int`, `double`, `date`, `datetime`, `geo_point_2d`, `geo_shape`. Field descriptions are German, and many are rich: units, code lists and formulas. For example, `obs_status` explains A/P/U, and `bruttozimmerauslastung` gives its formula.

For `georef-switzerland-gemeinde` the call fails with `ODS 404 NotFoundResource`, because that dataset lives on `public.opendatasoft.com`.

### `get_dataset_facets` [MCP]

Returns the values and counts of **facet fields only**.

- For `dfg_afg_econ_20260326`: `jahr`, `name`, `typ`, `kategorie`, but not `bfs_nummer` or `betrag`.
- For `dvs_awt_econ_20250203`: `datum`, `gemeinde_name`, `obs_status`, but not `gemeindenummer`.

Date facets come back as top-level years: `datum` gives `2021`…`2026`. **Each facet stops at 100 values.** `dfg_afg_econ_20260326.name` returned 100 names and silently left out Vals, Valsot, Vaz/Obervaz, Zernez, Zillis-Reischen, Zizers and Zuoz. The dataset has 107 distinct names, current plus merged municipalities [MCP, v2.1].

- The same 100 cap applies to the raw v2.1 `/facets` endpoint, even with `facet=facet(name="name", limit=200)` [v2.1].
- It also applies to v1 `facet=name&facet.limit=-1` [v1].
- **Workaround:** `get_records` with `select: "name, count(*) as n"`, `group_by: "name"` and `limit: 200` returned all 107 [MCP].

### `get_records` [MCP]

- **Plain records**: typed JSON, e.g. `{"jahr": "2019", "bfs_nummer": "3542", "betrag": 52.64, ...}`, plus `total_count`.
- **Year-precision date fields** come back as `"2019"`; full dates come back as ISO strings.
- **Geo fields**: `geo_point_2d` comes back as `{lon, lat}`.
- **Value ranges**: aggregate `select`s give ranges directly, e.g. `min(datum)`, `max(datum)`, `max(logiernachte)` and `count(distinct gemeindenummer)`. Results: `2021-01-01` to `2026-08-01`, a maximum of 131447, and 40 municipalities.
- **Quirk**: an aggregate `select` without `group_by` repeats the same single row `limit` times (10 by default). This is **upstream v2.1 behaviour**, reproduced with curl [v2.1], not an MCP bug. Pass `limit: 1`.

### `get_dataset_metadata` [MCP]

Returns the full `metas` tree: `default`, `dcat`, `dcat_ap_ch` and `custom`, with every language variant. Useful extras for a Page:

- `update_frequency`
- `attributions`, e.g. "Bundesamt für Statistik BFS", which can feed a source line
- `references`
- `license_url`
- `dcat.contact_email`
- `temporal_coverage_start`
- `geographic_reference`

The plain `title` and `description` keys hold the Romansh text, so use the `_de` keys.

### Other tools [MCP]

- **`get_dataset_attachments`**: `[]` for `dvs_are_soci_20250224`. The description there mentions a documentation link, but no file is attached.
- **`list_export_formats`**: for the geo dataset it includes `geojson`, `shp`, `kml` and `fgb`. That is an indirect "is this a geo dataset?" check.
- **`get_datasets`** (catalogue search): `refine: "features:geo"` restricts results to geo datasets. Searching "Gemeinden" with that refine found `dvs_awt_regi_202502110` (municipalities) and the USPAT1/USPAT2 units. A semantic search for "Gemeindegrenzen" also surfaced `dvs_awt_econ_202601260` (Tourismusdestinationen, 18 records). The result rows themselves do not carry `features`.

## What the MCP leaves out, and why it matters for Widgets

Compared with the raw APIs for the same datasets:

| Property | MCP `get_dataset` | Raw API | Matters for |
|---|---|---|---|
| `label` / `label_de` | missing | v2.1 `label_de`; v1 `label` with `?lang=de` | German headings and legends the agent writes itself. With no `lang`, v1 `label` is **Romansh** (`jahr` → "Onn", `betrag` → "Import") [v1]. |
| `annotations.timeserie_precision` | missing | v1/v2.1, e.g. `jahr` → `year`, `datum` → `month` | `ods-chart` `timescale`. `charts.js` builds the allowed timescales from this annotation, listing only scales up to that precision [widgets: `src/services/charts.js` ~L143-168, L247-256]. The Finanzkennzahlen page uses `timescale="year"` on `jahr` [pages]. |
| `features` (`geo`, `analyze`, `timeserie`) | missing | v1/v2.1 | Choosing a map Visualization, and spotting a geo companion dataset |
| `semantic_type` (`identifier`) | missing (shown as `text`) | v2.1; v1 shows the type as `identifier` | Join keys (`bfs_nummer`) |
| which fields are facets | not stated | **not exposed publicly either**: v1 `extra_metas` is `{}`, and v2.1 `annotations` has no facet entry | `ods-chart` lists text fields as X-axis options only if they are facets or carry the `analyse` annotation [widgets: `charts.js` ~L285-307]; facet-based Widgets need facet fields. Only observable via which fields `get_dataset_facets` returns. |

**Labels in rendered Widgets:**

- Widgets fetch the schema themselves at runtime through the v1 dataset endpoint, passing `lang` from `ODSWidgetsConfig.language` [widgets: `src/services/api.js` L33-34, L179-195].
- Column headers and axis labels drawn by the Widgets therefore come from the portal, not from the agent.
- The agent needs labels only for text it writes into the Page HTML.

## Is it enough to write correct `ods-*` attributes?

What the Example Pages use [pages], and whether the MCP output covers it:

- **Field names** in `field-x`, `expression-y`, `color-by-field`, `ods-adv-analysis-select`/`group-by`/`where`, and `refine.<field>`: **covered**. The ODSQL names from `get_dataset` are the names the Widgets use.
- **Refine values**, e.g. `'refine.typ':'Nettoschuld/-vermögen(-) je Einwohner in CHF'` and `'refine.standueberbauung_aggregiert2':'überbaut'`: **covered** by `get_dataset_facets`, or by `group_by` past 100 values.
- **`refine` on non-facet fields**, as the pages do with `refine.gemeindenummer` and `refine.bfsnr`: **works** on data.gr.ch [v1]. `refine.gemeindenummer=3851` gave 68 hits, `refine.bfsnr=3901` gave 22, and a bogus value gave 0. Refine is therefore not limited to facet fields.
- **Facets on non-facet fields**: v1 `facet=gemeindenummer` on a non-facet field returned values [v1]. So `ods-facet-results` with an explicit facet name likely works on any field. This is untested in a rendered Page.
- **Aggregations** (`SUM`, `COUNT`, `count(distinct ...)`, `max(...)`): **covered**. The agent can dry-run the exact ODSQL with `get_records` before writing it into `ods-adv-analysis`. That gives a cheap correctness check for verification.
- **Two query dialects in one Page**: the pages mix v1 context parameters (`refine.x`, `q`, `disjunctive.x`, `sort`) with ODSQL in `ods-adv-analysis-*`. `ods-adv-analysis` calls v2.1 [widgets: `src/services/api-v2.js` L102-111]. The MCP speaks ODSQL and v2.1 `refine` syntax (`field:value`). Converting to v1 context parameters (`'refine.field':'value'`) is up to the Widget knowledge, not the MCP.
- **Join keys between data and geometry**:
  - `dvs_awt_econ_20250203.gemeindenummer` is `int`, while `dvs_awt_regi_202502110.bfs_nummer` is `text` [MCP].
  - `dvs_are_soci_20250224` uses `bfsnr` (`int`).
  - The pages join with `ods-color-gradient-x="gemeindenummer"` and `color-by-field="bfs_nummer"` [pages].

  The MCP shows the types and names, enough to spot the mismatch. Whether the Widgets coerce types across the join is a Widget question.
- **Time axis**: field type `date` is visible. The precision (year or month) has to be inferred from record values, or read from the raw schema.

## Companion datasets

- **Geometry on data.gr.ch.** Beherbergungsstatistik and Überbauungsstand take municipality geometry from **`dvs_awt_regi_202502110`** on data.gr.ch. The page's context is *named* `swissboundaries3d20250120565728`, but the dataset is `dvs_awt_regi_202502110` [pages]. The MCP can read it fully.
- **Geometry on another domain.** Finanzkennzahlen and Tourismusdestinationen use `georef-switzerland-gemeinde-millesime` and `georef-switzerland-gemeinde` on `https://public.opendatasoft.com/`, with `refine.kan_code=18` [pages]. The MCP cannot read these (404 [MCP]).
- **The NASAK and Schneesportschulen pages** reference both `dvs_awt_regi_202502110` and `dvs_awt_regi_20250211`. Both IDs exist [v2.1].
- **Finding geometry**: `get_datasets` with `refine: "features:geo"` is the MCP's way to find data.gr.ch geometry for a Page Request.

## Recommended data-gathering steps for the generator

1. `get_dataset`: field names, types, descriptions, record count.
2. `get_dataset_facets`: which fields are facets, and their values. For any facet at exactly 100 values, run `get_records` with `group_by` to get the full list.
3. `get_records` with aggregate selects (`limit: 1`): value ranges and distinct counts. Watch for "Total" rows before summing [skill].
4. One raw `GET https://data.gr.ch/api/datasets/1.0/<id>/?lang=de`: German labels, `timeserie_precision` and `features`. This step exists only because the MCP leaves these out. Extending the MCP's `get_dataset` to return them would remove it.
5. Before writing each `ods-adv-analysis` into the Page, dry-run its ODSQL with `get_records`.
6. Geometry: data.gr.ch via `get_datasets` with `features:geo`. Off-domain geometry (`public.opendatasoft.com`) has to come from a curated list or the raw API.
