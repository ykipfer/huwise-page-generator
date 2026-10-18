# Huwise Page Generator

AI-assisted generation of Huwise pages for the data.gr.ch portal: a dataset and a request go in, a ready-to-paste page comes out.

## Language

**Page**:
One Huwise page, made of an HTML part and a CSS part, pasted into the Huwise page editor and embedded elsewhere via iframe. The unit the generator produces.
_Avoid_: Dashboard, visualization (for the whole page)

**Visualization**:
One chart, map, table, or KPI inside a Page. A Page holds one or more.
_Avoid_: Widget (for the visual element), chart (as the umbrella term)

**Widget**:
An ODS widget: one of the `ods-*` building blocks (directives) from the ods-widgets library that a Page is assembled from. A Visualization is built from one or more Widgets.
_Avoid_: Component, directive (in conversation)

**Pattern**:
A named, reusable combination of Widgets and expressions that does one job in a Page, such as filtering to the latest period, a dropdown filter, or a choropleth map with tooltip. A Page uses Patterns; a Pattern can make a Visualization, but it does not have to.
_Avoid_: Recipe, snippet, template

**Page Request**:
The input to one generation: a dataset ID from data.gr.ch plus a prompt describing the Visualizations wanted.
_Avoid_: Prompt (for the whole input), job

**CI Rules**:
The visual and content constraints (colours, fonts, visual conventions) every Page must follow, taken from the AWT Design System and its translation to the web in the Mittelverwendung Example Page.
_Avoid_: CD, branding, theme

**AWT Design System**:
The design system of the AWT (Amt für Wirtschaft und Tourismus) Daten und Statistik department, kept as a Claude Design project. Written for slides; the source the CI Rules are taken from.
_Avoid_: Portal theme (the data.gr.ch portal's own styling, which is a different thing)

**Example Page**:
One of the hand-built, published Pages kept as reference for structure, Widget usage, and CI Rules.
_Avoid_: Template, sample

**Host Page**:
The gr.ch page that embeds a Page in an iframe.
_Avoid_: Website, parent page

**Target Height**:
The fixed height of the iframe on the Host Page. A Page is made to fit it at every width.
_Avoid_: Page height

**Embed Size**:
The width setting of the iframe on the Host Page: Klein (at most 720px) or Gross (the full container).
_Avoid_: Format, mode

**Embed Caption**:
The text below the iframe on the Host Page, with a short description and the source (the gr.ch field "Legende").
_Avoid_: Legend (that is a chart's legend)
