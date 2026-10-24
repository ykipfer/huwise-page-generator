# Companion Dataset

A Page Request may name **one** Companion Dataset (data.gr.ch only), so a Page shows two related datasets side by side. This file is the whole procedure; the steps it touches (`intake.md`, `page-sketch.md`, `build-verify-handoff.md`) point here. Proven instance: `patterns/instances/companion-dataset/` (Zweitwohnungsanteil with Beherbergungsstatistik, shared Gemeinde filter). The values of the two datasets are **never combined**.

## Intake: find the shared dimension

Run the main dataset's intake (`intake.md` steps 2 and 3) and the same steps for the Companion Dataset. Then:

```
node intake.mjs shared <main-id> <companion-id> [mainField=companionField ...]
```

It lists candidate pairs (fields with the same name or the same German label, date fields excluded), compares their distinct values **as strings** (a text key and an integer key match) and prints per pair how many values both datasets have, which only one has, and a verdict. Name a renamed key yourself (`name=gemeinde_name`) or a key you found through the MCP; date fields and years are also checked by naming the pair.

- **A shared dimension exists** (`shared` above 0): report it to the owner with the counts ("40 of 100 Gemeinden also occur in the Companion Dataset; the filter will offer all 100, the other 60 show 'Keine Daten' on the Companion's area"). The dimension may be partial.
- **None exists**: say so in one line. **No shared filter is proposed.** The datasets are shown side by side, each with its own filters if the prompt asks for any. A shared filter is only ever built on a dimension this check found.

## Page Sketch and plan list

- The sketch gets the Companion Dataset's **own area** (a tab or a card, a labelled placeholder as always, with the dataset named in the label) and, per shared dimension, **one shared filter**. Both datasets' real facet values are checked by the shared-dimension run, so the filter shows real values.
- The **first tab** of the card should be the Companion Dataset's area when the Visualizations sit in tabs. The verifier explores the dropdown options before it clicks any tab, and a tab is rendered in the state the last option left: if that Gemeinde has no Companion rows, the guarded chart is never rendered and `widget-never-rendered` fails the Page. The first tab is rendered in the initial state, which has data.
- The plan list names, in the existing flag rows: **Companion Dataset needed** (the Companion Dataset, the shared dimension and its counts) and, when the prompt asks for a value built from both datasets (Logiernächte geteilt durch Einwohner, a ratio, a sum), the flag **values combined across datasets**: never combined, shown side by side instead, each value on its own context.
- The plan list's **Pattern** column says "4 (copy from `datactx` to `compctx`)" for every shared filter.
- The footer in the sketch already names both datasets.

## Build

- The Companion Dataset has **its own context `compctx`** (`core.md`, naming convention) and its own Visualizations (`context="compctx"`, `ods-aggregation-context="compctx"`, …). No Widget mixes `compctx` and `datactx` values.
- A shared filter is **Pattern 4**: the `ods-select` is bound to `datactx` and a hidden `{{ compctx.parameters['refine.<companion_field>'] = datactx.parameters['refine.<main_field>']; '' }}` copies it one way, renamed when the field names differ (`refine.gemeinde_name` from `refine.name`). One copy per shared filter. Never copy back.
- The copy passes the values untouched, so the field must hold the **same values** in both datasets. The names do (checked by `intake.mjs shared`); a text key and an integer key do not match through a refine, so use the field with the same spelling in both.
- A Gemeinde that the Companion Dataset lacks leaves `compctx` empty: guard its Visualizations with the empty-state message (Pattern 14, probe `ods-results` on `compctx`).
- Contexts created inside a latest-period `ng-if` (Pattern 3) are listed together in one `ods-dataset-context` (`context="datactx, mapctx, trendctx, compctx, geoctx"`); `compctx` stays unfiltered by the period unless the Page Request wants it.
- **Footer** (Pattern 15): "Letzte Aktualisierung" from `datactx`, then **one source link per dataset**, each with the dataset's ID in its `href`. The lint refuses a footer that omits either (`companion-footer`).

## Verify

`verify.mjs` needs nothing extra:

- **Lint** adds `companion-footer` (the footer names both datasets) and `companion-mixed-values` (an interpolation or expression reading Widget variables of `compctx` and of another dataset context). Both apply only to a Page that declares `compctx`.
- **Dry-run** checks every context against its own dataset, so fields and colour maps of `compctx` are checked against the Companion Dataset. The report lists the datasets it covered (`Dry-run datasets:` in `report.md`, `stages.dryRun.datasets` in `report.json`). A field of the main dataset used on `compctx` is reported as missing in the Companion Dataset.
- **Render** explores the shared filter's options like any filter, so the Companion's empty state is reached for a Gemeinde it lacks (reported as the warning `widget-variable-guarded`).

In the screenshot review, check that each dataset's values appear only in its own KPI, chart or table, and that the label of every area names its dataset.

## Pitfalls

- Never ask `datactx` and `compctx` for one number (`{{ logis / wohnungen }}`): `companion-mixed-values` fails it. Two KPI tiles next to each other are the answer.
- Both datasets may have a field named `jahr` with different types (a `date` year in one, `text` in the other). A shared year filter needs a checked pair and a rename; when in doubt, do not share the period.
- A second Companion Dataset is outside the Page Request. Ask the owner to choose one.
