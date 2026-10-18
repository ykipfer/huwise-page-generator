# Arbeitsmarkt seit 1993

Source: Held out
Covers: long time series, KPI tiles, tabs

## Dataset

- Main dataset: `dvs_kiga_econ_20260128` (Arbeitslose, Stellensuchende und Arbeitslosenquote, ab 1993; long format with fields `datum`, `jahr`, `metrik`, `wert`)
- Companion Dataset: none
- Boundary Dataset: none

Data note: `metrik` holds four measures in one field (Arbeitslosenquote, Registrierte Arbeitslose, Registrierte Stellensuchende, Nicht arbeitslose Stellensuchende). The quote is a percentage, the others are counts, so they must not share one axis.

## Prompt

> Zeig die Entwicklung des Bündner Arbeitsmarkts seit Beginn der Zeitreihe. Oben die aktuellen Werte: Arbeitslosenquote, registrierte Arbeitslose und Stellensuchende mit dem Monat, auf den sie sich beziehen. Darunter die Arbeitslosenquote als Zeitreihe über die ganze Zeitspanne, und in einem zweiten Tab die Bestände an Arbeitslosen und Stellensuchenden. Der Zeitraum soll einstellbar sein.

## Must-have checklist

- [ ] KPI tiles for the latest Arbeitslosenquote, Registrierte Arbeitslose and Registrierte Stellensuchende, each naming the month it refers to, taken from the data.
- [ ] Line chart of the Arbeitslosenquote across the whole series (monthly, since the first month of the dataset).
- [ ] Second tab with the counts (Arbeitslose, Stellensuchende, Nicht arbeitslose Stellensuchende) as time series.
- [ ] Two tabs built with the approved tab Pattern.
- [ ] Quote and counts are not on one shared axis.
- [ ] Period filter (year range) that applies to the charts.
- [ ] The long series stays readable at 375px (axis labels do not collide, no empty chart).
- [ ] Footer with the last-update date and a source link to the dataset.
