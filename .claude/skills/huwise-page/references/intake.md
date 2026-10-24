# Step 1: Intake

Goal: real field names, German labels and real facet values for the main dataset (and a Companion Dataset), plus the Boundary Dataset level the key field matches. Nothing is written yet.

All helper calls below run from the skill's `verifier/` folder: `node intake.mjs …`.

## 1. Load `ogd-graubuenden` first

Call the Skill tool with `ogd-graubuenden` **before the first data.gr.ch MCP call** of the run. It holds the known MCP pitfalls. Never copy its content into this repo.

## 2. Metadata, fields and facet values through the MCP

For each dataset (the main one, and the Companion Dataset if the Page Request names one):

1. Dataset metadata (title, description, update frequency, `data_processed`).
2. Fields: name, type, and which are dates, numbers, text, geo.
3. **Candidate facet values** for the fields the prompt could filter or break down by (a Gemeinde name, a year, a category). Fetch the distinct values with a count, sorted, with an explicit `limit`. Keep the real spellings: the sketch shows them, and the later colour maps must match them exactly.
4. The newest period (max of the date or year field) if the prompt says "latest" or "aktuell". The Page will compute it from the data; the sketch only shows it as a real filter value.

## 3. One raw v1 call for what the MCP leaves out

The MCP does not return German field labels, `timeserie_precision` or the geo/timeserie features. Make **one** raw v1 call per dataset, always in German:

```
node intake.mjs v1 <dataset_id>
```

It requests `https://data.gr.ch/api/datasets/1.0/<dataset_id>/?lang=de` (the `lang=de` is what returns German labels) and prints the title, `features` (`timeserie`, `geo`, `analyze`), and per field the label, type and `timeserie_precision` (`month`, `year`, …). Use the labels in KPI tiles, filters and placeholders. Use `timeserie_precision` to choose the chart's x-axis resolution and the date format.

## 4. MCP unavailable: Explore API fallback

If an MCP call fails or the server is not connected, say so to the owner in one line ("data.gr.ch MCP nicht verfügbar, die Daten kommen aus der öffentlichen Explore API") and continue with:

```
node intake.mjs explore <dataset_id>                       # title, fields (label_de), features
node intake.mjs facets <dataset_id> <field> [limit]        # distinct values with counts
```

The Explore API v2.1 returns field labels in the dataset's first metadata language (Romansh on data.gr.ch), so the helper reads `label_de`. It has no `timeserie_precision`; the v1 call (step 3) still supplies it. State the source again in the plan list.

## 5. Match the key field against the Boundary Dataset catalogue

If any Visualization is a map, or the prompt names a spatial level, match the data's key field to a level in `boundary-catalogue.md` (`boundary-catalogue.json`): compare the key's **meaning and type**, not just its name (`gemeindenummer` as integer is a BFS number and matches the Gemeinde level, whose key `bfs_nummer` is text, so the join casts both with `''+`).

- A level matches: note the entry. It goes into the plan list as a flag (second dataset, naming the catalogue entry).
- No level matches: flag it as a missing Widget or Pattern style gap, a **new level** through the deliberate add step. Never search for a boundary dataset.

## 6. Companion Dataset

Run steps 2 and 3 for the Companion Dataset too. Then check that the two datasets **share a dimension** (the same Gemeinde key, the same year, a common category): `node intake.mjs shared <main-id> <companion-id> [mainField=companionField ...]` compares the values of candidate field pairs as strings and reports the common values. Only a shared dimension allows shared filters (one-way copy, Pattern 4). If they share none, tell the owner and propose no shared filter. Values are never combined across the datasets. The full procedure (sketch, build, footer, verify) is in `companion-dataset.md`.
