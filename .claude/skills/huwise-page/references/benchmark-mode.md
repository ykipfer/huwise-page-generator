# Benchmark mode

`/huwise-page benchmark` judges the skill end to end (intake, sketch, build, verify, handoff material) on the six fixed requests in `benchmark/requests/`, without waiting for the owner six times. `/huwise-page benchmark <slug>…` runs a subset (slugs are the file names in `benchmark/requests/`). A full run costs about 180 API requests, so run one request first when you are only checking a change. Live Pages are not a pixel target.

All commands below run from the skill's `verifier/` folder (`node benchmark.mjs …`).

## Differences from a normal run

- **No questions.** Never ask the owner anything. The Page Request comes from the request file (prompt exactly as written, dataset ID(s), Target Height 800, Embed Size Gross unless the file says otherwise).
- **Auto-approve the first Page Sketch.** Build the sketch and run the sketch lint and preview as usual (open no browser: pass `--no-open` to `preview.mjs`), post the plan list into the run's notes, then treat the sketch as approved. **Keep it** right then: `node benchmark.mjs sketch <page-dir>` copies `index.html` and `stylesheet.css` into `<page-dir>/sketch/`. It is never overwritten, so the build cannot touch the copy that sketch fidelity is scored against.
- **Plan-list flags are recorded, not acted on.** Where a normal run would stop for the owner (missing Widget or Pattern, Companion Dataset needed, Boundary Dataset needed, content dropped, historical-state map, values combined across datasets), take the closest Widget-only, Pattern-only route, do not run the deliberate add step, and write the flag into `flags` of the result.
- **Run folder.** `node benchmark.mjs init [slug…]` makes the dated, gitignored run folder `benchmark/runs/<YYYY-MM-DD>/` (a second run on the same day becomes `<YYYY-MM-DD>-2`) with one Page folder per request, and prints the paths. Build and verify **in that Page folder** (`index.html`, `stylesheet.css`, `verifier-output/`). Nothing is written into the Pages directory (`pages/` at the repo root); `benchmark.mjs` refuses a run folder inside it, and `git status` after a run shows nothing new.
- **Same build, verify and iteration rules** as `build-verify-handoff.md` steps 5 and 6: at most 3 iterations, final pass at every width. Skip the owner-facing handoff and the chat screenshots; the results replace them.

## Scoring

Once verification ends (clean or at the cap), score three criteria, each 0, 1 or 2, with a **one-line reason**. Review the same screenshots as step 6 (375px and each state at 1200px).

| Criterion (key) | 2 | 1 | 0 |
|---|---|---|---|
| **Request fidelity** (`fidelity`) against the request file's must-have checklist **only** | every item met | one or two items missed or only partly met | three or more missed, or the main Visualization is missing |
| **CI and layout** (`ciLayout`): fits at 375/720/1200, cards and colours as in Mittelverwendung, no area that looks empty | all three hold | one blemish (a colour, spacing, a card style) | an area looks empty, content is cut off, or the CI Rules are clearly broken |
| **Sketch fidelity** (`sketchFidelity`): the final Page keeps the Page Sketch's areas, order and labels | all kept | one area, label or order change | areas missing or reordered substantially |

Run `node benchmark.mjs aid <page-dir>` before scoring sketch fidelity. It lists the sketch's `hw-` containers that the final Page lost (in order) and the placeholder labels that no longer appear anywhere in it. It is an aid; the score is yours. Do not score against the live Example Page.

Write the scores into a JSON file outside the run folder's Page folders and record them:

```
{ "iterations": 2, "flags": ["Companion Dataset needed: Beherbergungsstatistik"],
  "scores": { "fidelity": { "score": 2, "reason": "…" }, "ciLayout": { "score": 1, "reason": "…" }, "sketchFidelity": { "score": 2, "reason": "…" } } }
```

`node benchmark.mjs record <page-dir> <scores.json>` reads the verifier report for errors and warnings, applies the pass rule and writes `result.json`.

## Pass rule

A request passes when the verifier reports **no errors within 3 iterations** AND the rubric scores at least **4/6 with no 0**. Warnings are counted, not failed.

## Results and the owner's one pass

1. `node benchmark.mjs report <run-dir>` writes and prints `results.md`: per request pass or fail, iterations, warnings, the three scores with their reasons and the recorded flags. Scores show as awaiting the owner's confirmation.
2. Show the table to the owner. The owner confirms or overrides **all scores in one pass**: `node benchmark.mjs confirm <run-dir> [--override <slug>.<criterion>=<0|1|2>:<reason>]…`. An override replaces that score, keeps the agent's original in the result, and pass or fail is recomputed.
3. Run `report` again so `results.md` reflects the confirmed scores.

The run folder stays on disk, gitignored.

## Baseline and regressions

The **Baseline** is the tracked file `benchmark/baseline.json`: one row per request (pass or fail, iterations, warnings, the three rubric scores and total, and the field list of the request's datasets) from the last full run the owner accepted. Tool: `verifier/baseline.mjs`, run from `verifier/`. The schemas of the datasets are fetched live from the Explore API unless you pass `--schemas <file>` (`node baseline.mjs schemas` prints them).

- **Setting it.** Only a full run (all six requests recorded) whose scores the owner has confirmed can become the Baseline. The owner confirms: show the full run, and run `node baseline.mjs accept <run-dir>` only after the owner says the run is accepted. The first accepted v1 run sets it. A subset run can never set or replace it.
- **Comparing.** `node baseline.mjs compare <run-dir>` compares every recorded request with its Baseline row and writes `comparison.md` and `comparison.json` into the run folder. A subset run is compared the same way; the Baseline file is only read. A request is **worse** when it goes from pass to fail, its rubric total drops, or it needs more iterations (warnings alone are not worse).
- **Re-run once.** A worse request is shown as `needs-rerun`. Re-run it exactly once (`benchmark.mjs init <slug>`, build, verify, record, owner confirms), then `node baseline.mjs compare <run-dir> --rerun <rerun-run-dir>`. It is a **regression** only if the re-run is worse again; if not, it is reported as not reproduced. Both runs are recorded in `comparison.json`. A second re-run of the same request is refused.
- **Dataset changed.** A request whose dataset was removed, renamed or replaced, or lost a field or changed a field's type since the Baseline, is reported as **dataset changed**, separately from regressions. Propose a replacement from the data.gr.ch catalogue (`--proposals <file>`: `{ "<slug>": { "dataset": "<id>", "note": ".." } }`). Added fields are not a change.
- **Accepting a replacement.** When the owner accepts it, update the request file (dataset ID, field names, checklist), run that request, have the owner confirm it, then `node baseline.mjs reset <run-dir> <slug> --note "<why>"`. That one row is reset to the new run's result with the note; the other rows stay.
