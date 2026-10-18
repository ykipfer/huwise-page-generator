# Mittelverwendung im Bereich Landeslotterie

Source: Example Page (`page_examples/Mittelverwendung im Bereich Landeslotterie`)
Covers: CI reference, value-to-colour maps, KPI tiles, tabs

## Dataset

- Main dataset: `ekud_ekud_econ_20260716`
- Companion Dataset: none
- Boundary Dataset: none

## Prompt

> Zeig mir die Mittelverwendung der Landeslotterie. Oben das aktuellste Jahr mit der Summe der Beiträge und der Anzahl unterstützter Projekte. Dazu ein Filter nach Kategorie und Jahr sowie eine Suche nach Projekt. Als Hauptteil eine Tabelle aller Beiträge und daneben, per Tab umschaltbar, ein gestapeltes Säulendiagramm mit dem Anteil der Kategorien pro Jahr. Jede Kategorie soll in jedem Diagramm dieselbe Farbe haben.

## Must-have checklist

- [ ] KPI tile with the sum of `beitrag_chf_pro_projekt` for the latest year.
- [ ] KPI tile with the number of supported projects for the latest year.
- [ ] Both KPI labels name the year they show, and the year follows the data (no hard-coded year).
- [ ] Filter on `kategorie` (multi-select, all categories offered with real facet values).
- [ ] Filter on `jahr`, defaulting to the latest year.
- [ ] Text search on `unterstutztes_projekt`.
- [ ] Two tabs (table and chart), built with the approved tab Pattern, table shown first.
- [ ] Table with columns project, category, beneficiary, amount (CHF), year.
- [ ] Stacked-to-100% column chart: x = `jahr`, breakdown by `kategorie`, sum of `beitrag_chf_pro_projekt`.
- [ ] Every `kategorie` value has a fixed colour from the CI palette, and the colour map's keys match the data.
- [ ] Footer with the last-update date and a source link to the dataset.
