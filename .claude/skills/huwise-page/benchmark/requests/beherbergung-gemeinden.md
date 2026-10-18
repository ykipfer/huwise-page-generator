# Beherbergungsstatistik der Gemeinden

Source: Example Page (`page_examples/Beherbergungsstatistik der Gemeinden`)
Covers: choropleth with a Boundary Dataset, key coverage

## Dataset

- Main dataset: `dvs_awt_econ_20250203` (key field `gemeindenummer`, integer; covers only the 40 frequenzstärksten Gemeinden)
- Companion Dataset: none
- Boundary Dataset: `dvs_awt_regi_202502110` (Gemeinden, key `bfs_nummer`)

## Prompt

> Mach eine Karte der tourismusintensivsten Gemeinden: Die Gemeinden sollen nach Logiernächten im aktuellsten Monat eingefärbt sein. Beim Darüberfahren sollen Logiernächte, Ankünfte, Zimmernächte, durchschnittliche Aufenthaltsdauer und Bruttozimmerauslastung stehen, jeweils mit dem Vergleich zum selben Monat des Vorjahres.

## Must-have checklist

- [ ] One choropleth map of the Gemeinden, joined to the Boundary Dataset by BFS number.
- [ ] Colour is a gradient of the sum of `logiernachte`, with a legend titled "Logiernächte".
- [ ] The map shows the latest month in the data, derived from the data (no hard-coded year or month).
- [ ] Gemeinden without data are drawn in a neutral colour, not left out or shown as zero.
- [ ] Key coverage is checked: the 40 Gemeinden of the dataset match shapes, and unmatched ones are reported.
- [ ] Tooltip per Gemeinde with Logiernächte, Ankünfte, Zimmernächte, durchschnittliche Aufenthaltsdauer and Bruttozimmerauslastung.
- [ ] Each tooltip value shows the latest month, the same month one year earlier and the change.
- [ ] Bruttozimmerauslastung change is in percentage points, the others in percent.
- [ ] Footer with the last-update date and a source link to the dataset.
