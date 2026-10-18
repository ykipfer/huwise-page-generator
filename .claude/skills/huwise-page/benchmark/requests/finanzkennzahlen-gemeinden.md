# Finanzkennzahlen der Bündner Gemeinden

Source: Example Page (`page_examples/Finanzkennzahlen der Bündner Gemeinden`)
Covers: KPI/table Page, regenerated on a data.gr.ch Boundary Dataset (the live Page uses a public Opendatasoft dataset for shapes)

## Dataset

- Main dataset: `dfg_afg_econ_20260326` (key field `bfs_nummer`)
- Companion Dataset: none
- Boundary Dataset: `dvs_awt_regi_202502110` (Gemeinden, key `bfs_nummer`)

## Prompt

> Zeig die Finanzkennzahlen der Bündner Gemeinden in drei Tabs. Karte: Die Gemeinden nach der gewählten Finanzkennzahl in Ampelfarben für das neueste Jahr, mit Filter für die Kennzahl. Entwicklung: pro Jahr der Anteil der Gemeinden je Kategorie der gewählten Kennzahl. Vergleich: ausgewählte Gemeinden nebeneinander, mit Filter für Kennzahl, Jahr und Gemeinden, dazu eine Tabelle.

## Must-have checklist

- [ ] Three tabs: map, development, comparison, built with the approved tab Pattern.
- [ ] Map tab: choropleth of the Gemeinden joined to the Boundary Dataset by BFS number.
- [ ] Map tab: filter on `typ` (the Finanzkennzahl) with the real facet values.
- [ ] Map colours are a value-to-colour map from `kategorie` to traffic-light colours, and the map's keys match the data.
- [ ] The map shows the latest year in the data (no hard-coded year), and the label names it.
- [ ] Gemeinden without data are drawn in a neutral colour.
- [ ] Map legend lists the categories.
- [ ] Tooltip per Gemeinde with the Kennzahl value and category.
- [ ] Development tab: stacked-to-100% column chart over `jahr`, counting Gemeinden per `kategorie`, for the chosen Kennzahl.
- [ ] Comparison tab: filters for Kennzahl, Jahr and Gemeinde (multi-select), and a chart of the chosen Gemeinden.
- [ ] Comparison tab: a table of the same values.
- [ ] A KPI tile or key figure shows, for the chosen Kennzahl and latest year, the number of Gemeinden per category.
- [ ] Footer with the last-update date and a source link to the dataset.
