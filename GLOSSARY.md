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

**Page Request**:
The input to one generation: a dataset ID from data.gr.ch plus a prompt describing the Visualizations wanted.
_Avoid_: Prompt (for the whole input), job

**CI Rules**:
The canton's corporate-design constraints (colours, fonts, visual conventions) every Page must follow, as established by the existing example Pages.
_Avoid_: CD, branding, theme

**Example Page**:
One of the hand-built, published Pages kept as reference for structure, Widget usage, and CI Rules.
_Avoid_: Template, sample
