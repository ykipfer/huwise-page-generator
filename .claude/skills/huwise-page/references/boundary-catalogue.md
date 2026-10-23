# Boundary Dataset catalogue

A **Boundary Dataset** holds the shapes of one spatial level. A map joins a data dataset to it by hand (`ods-color-gradient`, then `color-categories` + `color-by-field`, core.md "Maps"). The list is **closed**:

- Boundary Datasets come only from data.gr.ch, never from another portal and never from a free search.
- Match the data's key field to a level here. If no level fits, flag it in the plan list: a **new level** goes through the deliberate add step.
- A **new snapshot** of a level (a Gemeindefusion, a new boundary release) is a hand update of this file and of `boundary-catalogue.json`. Do not swap a dataset ID on the fly.

The table below is confirmed live (record count, key field and type, name field) by the verifier tests. `boundary-catalogue.json` is the same data in machine-readable form; the dry-run reads it.

| Level | Dataset | Records | Key field (type) | Name field | Snapshot |
|---|---|---|---|---|---|
| Gemeinde | `dvs_awt_regi_202502110` | 100 | `bfs_nummer` (text) | `name` | 01.01.2025 |
| Region | `dvs_awt_regi_20250211` | 11 | `name` (text) | `name` | 01.01.2025 |
| Tourismusdestination | `dvs_awt_econ_202601260` | 18 | `tourismusdestination` (text) | `tourismusdestination` | n/a |
| Raumbeobachtung 1 | `dvs_awt_regi_202503250` | 203 | `u1_id` (int) | `u1_name` | 2025 |
| Raumbeobachtung 2 | `dvs_awt_regi_202503251` | 21 | `u2_id` (int) | `u2_name` | 2025 |

## Using an entry

- **Context:** the Boundary Dataset goes on `geoctx` (core.md, "Context naming convention"). The map layer's `color-by-field` is the entry's key field.
- **Keys are strings.** `gemeindenummer` (int) in a data dataset matches `bfs_nummer` (text) only when compared as strings. Cast refine values with `''+` (core.md, "Expression idioms"). The dry-run compares as strings.
- **Snapshot.** The shapes are the snapshot's municipalities. A data key of a municipality that has since merged has no shape. Show only periods whose keys match the snapshot (use a default filter on the period), or the dry-run reports the key.

## Key-coverage check

The dry-run (`verifier/dryrun.mjs`) joins each map layer fed by `ods-color-gradient` to its data context and checks, as strings:

- **Error `dry-run-key-coverage`:** a data key (the gradient's `-x` field) that has no shape in the Boundary Dataset. The message lists the keys.
- Boundary shapes without data are **not** an error. They render in the `color-categories-other` grey.
- Only keys within the data context's **literal default filters** (`<ctx>-parameters` with `refine.` / `exclude.`) are compared. A default computed at runtime (`''+latest[0].jahr`, or the guarded default) cannot be evaluated: the check then runs without it and reports warning `dry-run-key-coverage-filter-ignored`. Put a literal filter in the context's initial parameters to check exactly what the reader sees first.
- **Error `dry-run-boundary-not-in-catalogue`:** the layer's context is a dataset outside this catalogue.
- **Error `dry-run-boundary-key-mismatch`:** the layer's `color-by-field` is not the catalogue's key field for that dataset.

Cost: 2 metadata requests plus one request per 100 distinct keys on each side (a Gemeinde map with 40 data keys: 4 requests).
