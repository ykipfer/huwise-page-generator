---
name: huwise-page
description: Turn a Page Request (a data.gr.ch dataset ID and a German prompt) into a verified, paste-ready Huwise Page. Use when the owner wants a Page for data.gr.ch, runs /huwise-page, or refines a Page in pages/.
---

# /huwise-page

Builds a Huwise **Page** (HTML + CSS, no JS) for data.gr.ch from a **Page Request**: a dataset ID, optionally one Companion Dataset, and a German prompt. Vocabulary is in `GLOSSARY.md`; decisions are in `docs/adr/`. Nothing of this skill goes into `CLAUDE.md`.

## The Page Request

- **Dataset ID** (required) and a **German prompt** (required).
- **Target Height** in px, default **800**. **Embed Size** Klein or Gross, default **Gross**. An explicit **title**, off by default (the Embed Caption carries it).
- At most one Companion Dataset.

Ask for nothing else. If the dataset ID or prompt is missing, ask for it.

## Workflow

1. **Intake**: `references/intake.md`. Load `ogd-graubuenden` before any data.gr.ch MCP call, fetch metadata, fields and facet values, make one raw v1 call in German (`verifier/intake.mjs v1 <id>`), match the key field against the Boundary Dataset catalogue. If the MCP is unavailable, use the public Explore API (`verifier/intake.mjs explore <id>`) and say so.
2. **Page Sketch**: `references/page-sketch.md`. Widget-free markup on the base stylesheet, with placeholders, in `pages/<slug>/`.
3. **Preview**: `verifier/preview.mjs pages/<slug> --target-height <N> --embed-size <size>` writes `preview.html` and opens it in the browser.
4. **Plan list in chat** with flags, then the gate: regenerate the sketch on every change request until the owner says ok. Nothing is built before that. Normal runs cannot skip it.
5. **Build**: `references/build-verify-handoff.md`. The approved sketch markup becomes the Page; placeholders are swapped for closed-list Widgets from Patterns, containers, classes and order kept, no custom JS, latest-period defaults computed from the data.
6. **Verify**: `node verifier/verify.mjs pages/<slug> --target-height <N> --embed-size <size> --iterate` while iterating (lint, dry-run, render at 1200px), then the same without `--iterate` for the final pass at every width. Review the 375px shot and each state at 1200px against the CI Rules and the Page Request. At most 3 fix iterations; then stop and show the report. About 30 API requests per full run.
7. **Handoff**: `node verifier/handoff.mjs pages/<slug> --dataset-title "<title>" --caption "<Legende>" --iterations <n>` writes `pages/<slug>/handoff.md` (editor steps, embed URL, gr.ch component values, verification summary, screenshots); repeat it in chat with the 375px and 1200px screenshots. A Page still failing after 3 iterations gets the same file marked "not passing".

**Refinement**: a change after handoff edits `pages/<slug>/` in place and re-runs steps 6 and 7 in full with a fresh 3-iteration cap, even for a CSS tweak; a change to the plan (a new Visualization, another shape) goes back through steps 2 to 4 and the owner's ok first. See the Refinement section of `references/build-verify-handoff.md`.

Always read `references/core.md` and `references/rulebook.md` before writing a Page. Never commit; the owner decides what goes into history. The Page folder's `index.html`, `stylesheet.css` and `handoff.md` are tracked, `preview.html` and `verifier-output/` are ignored.

## Widget index

One line per Widget of the closed list (`references/widgets.json`): markup, job, family file. Read the family file of every Widget you use.

- `ods-dataset-context`: a named connection to a dataset plus query parameters; every data Widget reads through one. `references/widgets/context.md`
- `ods-results`: repeat over the records of a context. `references/widgets/data.md`
- `ods-facet-results`: the distinct values of a field with counts (filter options, latest period). `references/widgets/data.md`
- `ods-adv-analysis`: an ODSQL aggregation (`select`, `group-by`, `where`) into a variable. `references/widgets/data.md`
- `ods-aggregation`: one aggregated number (KPI tile). `references/widgets/data.md`
- `ods-table`: a table of records. `references/widgets/data.md`
- `ods-gauge`: one value on a gauge. `references/widgets/data.md`
- `ods-select`: dropdown filter writing into context parameters. `references/widgets/filter.md`
- `ods-text-search`: text search box on a context. `references/widgets/filter.md`
- `ods-chart`: a chart container (column, bar, line, …). `references/widgets/chart.md`
- `ods-chart-query`: the query of a chart (context, grouping, breakdown). `references/widgets/chart.md`
- `ods-chart-serie`: one series of a chart query. `references/widgets/chart.md`
- `ods-map`: a map container. Always `scroll-wheel-zoom="false"`. `references/widgets/map.md`
- `ods-map-layer`: a data layer of a map. `references/widgets/map.md`
- `ods-color-gradient`: sequential colouring of a map layer from a data context (joined by hand to a Boundary Dataset). `references/widgets/map.md`
- `ods-legend`: a legend for a colour map. `references/widgets/map.md`
- `ods-simple-tabs`: tab container; one Visualization per tab. `references/widgets/tabs.md`
- `ods-simple-tab`: one tab of `ods-simple-tabs`. `references/widgets/tabs.md`

## Source fallback

When `core.md` and the family file are both silent about a **listed** Widget, you may read the ods-widgets source (`ods-widgets/src`, the owner's gitignored checkout). Then tell the owner what the reference lacked, cite `<file>:<line>`, and propose the addition. **Never edit the reference on your own**; the owner decides. A Widget that is not on the list is not read, it is flagged (add step below).

## Deliberate add step

The closed lists (the Widget list, the Patterns and the Boundary Dataset catalogue) grow in one way only: write the entry, prove it renders through the verifier (`verifier/verify.mjs`), then add it. Never improvise a Widget, Pattern or Boundary Dataset inside a Page. A plan-list flag "missing Widget or Pattern" or "new level" means this step runs before the build, with the owner's agreement. The Widget, the Patterns or the Boundary Dataset catalogue entry is added only after the verifier passes on a Page that uses it.

## Files

- `references/`: `core.md`, `rulebook.md`, `base-stylesheet.css`, `widgets/`, `patterns/`, `skeleton/` (static shapes for sketches; `skeleton/page/` is the complete skeleton Page, the starting point for a built Page), `boundary-catalogue.md`, `intake.md`, `page-sketch.md`.
- `verifier/`: `verify.mjs` (staged check), `intake.mjs`, `preview.mjs`, `handoff.mjs`. Run `npm install` and `npx playwright install chromium` there once.
- Optional API key: set the environment variable `HUWISE_APIKEY` to a data.gr.ch API key for a higher request limit than anonymous access. The verifier (dry-run, render, `intake.mjs`) then sends it as `Authorization: Apikey <key>`, only to the `data.gr.ch` host and only for `/api/` paths, never to other hosts. Without it nothing changes. Keep the key in the environment only: never in a file, report, fixture or commit.
- `benchmark/`: the six fixed Page Requests.
- `pages/<slug>/` at the repo root: one folder per Page.
