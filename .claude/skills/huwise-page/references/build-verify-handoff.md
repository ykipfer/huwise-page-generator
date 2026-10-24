# Steps 5 to 7: build, verify, handoff

Starts only after the owner said **ok** to the Page Sketch and its plan list (`page-sketch.md`, the gate). Read `core.md` and `rulebook.md` again if they are not in context, and the family file of every Widget you are about to write. All commands run from the skill's `verifier/` folder; `pages/<slug>/` is at the repo root, so pass `../../../../pages/<slug>` or an absolute path.

## Step 5: build

The approved sketch markup in `pages/<slug>/index.html` **becomes the Page**. Edit that file in place.

1. **Keep** the containers, classes, order and labels of the sketch: the shape, the KPI row, the filters, the areas and the footer stay as approved. Only the placeholders change. `skeleton/page/` is the model for a built Page: its contexts (`yearctx`, `datactx`, `geoctx`), the tab structure and the footer inside the main context show how the Patterns combine. Swap dataset, fields and labels, keep the structure.
2. **Swap each placeholder** (`hw-placeholder`) for its Widgets, using the Pattern named in the plan list. Copy the Pattern's snippet from `patterns/<nn>-….md`, fill its `{snake_case}` placeholders from intake (real field names, real facet values) and keep the Pattern's pitfalls in mind. The placeholder's label becomes the chart's `label-y`, the tab's `label` or the KPI label, so the labels the owner approved are the labels that ship. A filter's real default value stays the default.
3. **Closed list only.** Every `ods-` element or attribute is one of the 18 Widgets of `widgets.json`. Anything else is not improvised: it goes through the deliberate add step (SKILL.md) with the owner's agreement, and in benchmark mode it is recorded as a flag.
4. **Contexts follow the naming convention** (`core.md`): `datactx`, `geoctx`, `tipctx`, `compctx`, `<name>ctx`. Every Widget sits inside its context's element. The footer (Pattern 15) stays the last child of `.hw-page`, inside the main context.
5. **No custom JS.** Never write `<script>` or `ods-import-script`, not even to make something work. A request that would need JS (a custom calculation, a hand-drawn chart, a resize script) gets the **closest Widget-only Page**, and the handoff and the chat reply say in one sentence what was left out and why.
6. **Latest-period defaults are computed from the data** and stay overridable: Pattern 3 (variant A with a facet sorted `-num`, or variant B with `max(…)` plus the guarded default). Never type a year or a month. The reader can still pick another period.
7. Empty results get an empty-state message (Pattern 14). German only, factual, no emoji, no exclamation marks (rulebook). Numbers with `| number:0`, dates like `Dez 2026`.
8. **Stylesheet**: `stylesheet.css` is the base stylesheet unchanged, plus the Page's own rules and the Target Height on the last line (`.hw-page { --target-height: <N>px; }`). Do not write a height of your own for a chart or a map.

Dry-run every literal ODSQL query through the MCP's `get_records` before writing it into the Page (`core.md`), so the verifier's dry-run does not find it first.

**Companion Dataset.** When the Page Request names one: its own context `compctx` and Visualizations, one Pattern 4 copy per shared filter, a footer linking both datasets, never a value combined across them. See `companion-dataset.md`.

## Step 6: verify

The verifier is staged: lint, then dry-run (data), then render in an iframe at the Target Height, then **your** screenshot review. A stage runs only when the earlier ones are clean. A full run costs about 30 anonymous API requests (the dry-run's), so use the budget on fixes, not on blind retries.

**Iterations.** Iteration 1 is the first run on the built Page. Each fix followed by a re-run is one more iteration. **At most 3 fix iterations**, so at most 4 runs in total, of which the last is the final pass.

- **While iterating**, render at 1200px only:
  `node verify.mjs <page-dir> --target-height <N> --embed-size <klein|gross> --iterate`
- **Final pass**, once an iteration is clean, run again **at every width** (Gross 375, 720, 1200; Klein 375, 720), without `--iterate`:
  `node verify.mjs <page-dir> --target-height <N> --embed-size <klein|gross>`
  The final pass is the report the handoff cites. A failure on the final pass is a finding like any other: fix it and use up an iteration. If the cap is reached, stop.
- Read `verifier-output/report.md` after every run. Fix the cause, not the symptom (an `ng-repeat-out-of-scope` is a scope problem, not a missing guard). Findings are errors or warnings; warnings never fail a Page, but list every one in the handoff.
- When the report passes, the agent still reviews the screenshots (below). A problem found there is fixed like an error and costs an iteration.

**Screenshot review.** Open `verifier-output/screenshot-375.png` (the full 375px shot) and, from the report's "Explored states" table, the shot of **each state at 1200px** (`state-<n>-1200.png`, plus `screenshot-1200.png` for the initial state). Judge them against the **CI Rules** (`rulebook.md`, `base-stylesheet.css`) and the Page Request:

- colours: brand `#2D2D8A` and the CI chart order, no stray default palette, no red as a category, status colours only for real ratings;
- cards: paper background, 12px radius, KPI cards with the brand top border, no gradients, no banner;
- areas that **look empty** (a chart or map frame with no visible data, a KPI showing "–", a blank table);
- overlaps and clipping (labels over the footer, a legend over the map, text cut off at 375px);
- every area, order and label of the approved sketch is still there, and the prompt's request is met.

The scripts catch signals; the review catches what looks wrong. Write one line per screenshot to yourself; only problems go into the chat.

**Stop after 3 failed iterations.** Show the report to the owner (the table of findings and the path to `verifier-output/report.md`) and go to the handoff as **not passing**. Do not keep trying.

## Step 7: handoff

Write the handoff file into the Page folder, then repeat it in chat:

```
node handoff.mjs <page-dir> --dataset-title "<German dataset title>" --caption "<Legende>" --iterations <n> [--gap "<reference gap>"]... [--not-passing]
```

It reads `verifier-output/report.json`, writes `pages/<slug>/handoff.md` and prints it. The sections come in this order:

1. **Editor steps**: create a Page with the slug; paste the HTML into the DE HTML field and the CSS into the DE CSS field; leave EN and IT empty.
2. **Embed URL**: always `https://data.gr.ch/pages/<slug>/?headless=true&flg=de-ch`, with the warning not to use the Sharing tab's snippet.
3. **gr.ch component values**: "Höhe (px)" is the Target Height, the Embed Size, and the suggested **Legende** (the Embed Caption). The Legende is at most 200 characters and names the dataset as the source (for example "Logiernächte nach Gemeinde und Monat. Quelle: Beherbergungsstatistik, data.gr.ch"). The tool refuses a longer Legende or one without the dataset title.
4. **Verification summary**: pass or fail, warnings, and the **reference gaps** found (a Widget parameter the family file lacked and that you read from the source, with `<file>:<line>`; the proposed addition goes here, the reference itself is never edited).
5. **Screenshots**: paths to all of them.

**In chat**, paste the handoff text, then show the **375px** and **1200px** screenshots (open the PNGs so the owner sees them) and give the paths of the rest.

- `--not-passing` marks the file "not passing" when the verifier is clean but your screenshot review still found a problem. A failing report, a skipped stage or a final pass that did not render every width is marked "not passing" by the tool on its own. In both cases the file lists the open errors and the chat says so first.
- A Page that failed after 3 iterations gets the same file, marked "not passing", with the open errors. There is no clipboard helper.

## Git

The Page folder's `index.html`, `stylesheet.css` and `handoff.md` are tracked; `preview.html` and `verifier-output/` are ignored (`.gitignore`). **The generator never commits**, and never stages: `git status` after a run shows only those three files as new, and the owner decides what goes into history. Run `git status --short pages/<slug>` as the last check and say so if anything else shows up.

## Refinement

The owner asks for a change after the handoff, in the same session. The Page folder `pages/<slug>/` is **edited in place**: same slug, same files, no copy, no second folder. Decide first which of the two kinds it is.

**Same plan (CSS-only, label, colour, spacing, a filter default, a different field of the same Visualization).** Edit `index.html` and/or `stylesheet.css` in place, then:

1. Re-run the **full staged check**: lint, dry-run, render, screenshot review, exactly as in step 6. The check re-runs every stage, even for a CSS-only change: a CSS tweak can overflow the Target Height, hide a chart or break the 375px shot. There is no shortcut run and no "only lint".
2. The **fresh 3-iteration cap** applies: the first run after the edit is iteration 1 again, with at most 3 fix iterations, whatever the earlier build or earlier refinements used. The count in the handoff is this refinement's count.
3. **Rewrite the handoff** with `handoff.mjs` (step 7), using the new iteration count, and repeat it in chat with the new 375px and 1200px screenshots. The old `handoff.md` is overwritten, never edited by hand. Run `git status --short pages/<slug>` as the last check (the generator still never commits).

**Plan changes (a new Visualization, a removed one, another shape, a new filter or KPI row, a Companion Dataset or a map).** Nothing is built before the owner approves the new plan:

1. Go back to the Page Sketch gate (`page-sketch.md`): edit the sketch markup in `pages/<slug>/` in place, re-run lint (`--no-dry-run --skip-render`) and `preview.mjs`, which regenerates `preview.html` and opens it, and post the **changed plan list** with its flags.
2. Wait for the owner's explicit **ok** (or "freigegeben"). Until then do not swap in Widgets, run the dry-run or render, or touch the handoff. Change requests regenerate the sketch again.
3. After the ok, build (step 5), verify (step 6, **fresh cap**, iteration 1) and hand off (step 7) as for a new Page.

If it is unclear which kind a request is, treat it as a plan change: a gate costs a minute, a wrong build costs a verifier run.
