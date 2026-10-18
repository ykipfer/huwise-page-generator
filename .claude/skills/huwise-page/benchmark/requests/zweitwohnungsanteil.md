# Zweitwohnungsanteil

Source: Held out
Covers: Companion Dataset, shared Gemeinde filter, KPI tiles

## Dataset

- Main dataset: `dvs_awt_soci_20260112` (Zweitwohnungsanteil 2017 bis heute; key field `bfs_nummer`, text; fields `name`, `jahr`, `semester`, `zwg_3110` Anteil Erstwohnungen, `zwg_3120` Anteil Zweitwohnungen)
- Companion Dataset: `dvs_awt_econ_20250203` (Beherbergungsstatistik der Gemeinden; key field `gemeindenummer`, integer; fields `gemeinde_name`, `logiernachte`, `datum`)
- Boundary Dataset: `dvs_awt_regi_202502110` (Gemeinden, key `bfs_nummer`)

Shared Gemeinde key: confirmed 2026-10-18 through the data.gr.ch MCP. All 40 BFS numbers of the Companion Dataset also occur in the main dataset (100 Gemeinden). The types differ (text vs integer), so the Page must normalise one side before comparing. The Companion Dataset covers only the 40 frequenzstärksten Gemeinden, so a shared Gemeinde filter offers just those.

## Prompt

> Zeig den Zweitwohnungsanteil der Bündner Gemeinden. Oben der Anteil Zweitwohnungen im Kanton für das neueste Jahr, dazu eine Karte der Gemeinden nach Zweitwohnungsanteil. Daneben, in eigenen Darstellungen, die Logiernächte aus der Beherbergungsstatistik. Mit einem Gemeindefilter, der für beide Datensätze gilt. Die Werte der beiden Datensätze sollen nicht verrechnet werden.

## Must-have checklist

- [ ] KPI tile with the Zweitwohnungsanteil for the latest year (from `zwg_3120`), with the year named in its label, taken from the data.
- [ ] Choropleth map of the Gemeinden by Zweitwohnungsanteil, joined to the Boundary Dataset by BFS number, with legend.
- [ ] Gemeinden without data drawn in a neutral colour.
- [ ] A time-series chart of the Zweitwohnungsanteil over the years for the selected Gemeinde.
- [ ] Visualizations of the Companion Dataset (Logiernächte over time) are separate from the main dataset's, in their own area.
- [ ] One Gemeinde filter drives both datasets, matching them by BFS number (text vs integer handled).
- [ ] The plan list flags the Gemeinde filter and names the shared dimension.
- [ ] No value mixes the two datasets (no ratio of Logiernächte to Wohnungen).
- [ ] Gemeinden missing in the Companion Dataset show a clear "keine Daten" state, not an empty chart.
- [ ] Footer with the last-update date and source links to both datasets.
