# Benchmark

The fixed set of six Page Requests the skill is judged on. One file per request under `requests/`. Each holds the prompt as the owner would type it (German, no years), the dataset ID(s) and a must-have checklist that request fidelity is scored against.

| File | Source | Covers |
|---|---|---|
| `mittelverwendung-landeslotterie` | Example Page | CI reference, value-to-colour maps |
| `beherbergung-gemeinden` | Example Page | choropleth with a Boundary Dataset, key coverage |
| `finanzkennzahlen-gemeinden` | Example Page | KPI/table Page on a data.gr.ch Boundary Dataset |
| `zweitwohnungsanteil` | Held out | Companion Dataset, shared Gemeinde filter |
| `tourismus-herkunftslaender` | Held out | time series, filters |
| `arbeitsmarkt-seit-1993` | Held out | long time series |

## Coverage across the set

| Feature | Requests whose checklist asks for it |
|---|---|
| KPI tiles | mittelverwendung-landeslotterie, finanzkennzahlen-gemeinden, zweitwohnungsanteil, tourismus-herkunftslaender, arbeitsmarkt-seit-1993 |
| Tabs | mittelverwendung-landeslotterie, finanzkennzahlen-gemeinden, arbeitsmarkt-seit-1993 |
