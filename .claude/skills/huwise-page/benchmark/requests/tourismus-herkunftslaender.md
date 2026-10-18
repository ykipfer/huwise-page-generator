# Dashboard Tourismus Herkunftsländer

Source: Held out
Covers: time series, filters, KPI tiles

## Dataset

- Main dataset: `dvs_awt_econ_202502030` (Monatliche Ankünfte und Logiernächte nach Herkunftsland; fields `datum`, `jahr`, `monat`, `iso_landername`, `ankunfte_hk`, `logiernachte_hk`)
- Companion Dataset: none
- Boundary Dataset: none

Data note: `iso_landername` mixes single countries with groupings (such as "Golf-Staaten" or "Baltische Staaten"); the Page must not add groupings and their member countries together.

## Prompt

> Ich möchte ein Dashboard zu den Hotel-Logiernächten nach Herkunftsland der Gäste. Oben die Logiernächte und Ankünfte des letzten Jahres mit der Veränderung zum Vorjahr. Dann die Entwicklung der Logiernächte pro Jahr als Zeitreihe und die wichtigsten Herkunftsländer im Vergleich. Mit Filter für Herkunftsland und Zeitraum.

## Must-have checklist

- [ ] KPI tiles for Logiernächte and Ankünfte of the latest full year, each with the change to the previous year, and the year taken from the data.
- [ ] Time-series chart of Logiernächte over `datum` (yearly or monthly aggregation, stated in the label).
- [ ] Comparison chart of the top Herkunftsländer by Logiernächte for the selected period (limited count, sorted).
- [ ] Filter on `iso_landername` with real facet values, multi-select.
- [ ] Filter on the period (year range or year).
- [ ] Country and grouping rows are not summed together.
- [ ] Charts have axis labels and units; long country names stay readable at 375px.
- [ ] Footer with the last-update date and a source link to the dataset.
