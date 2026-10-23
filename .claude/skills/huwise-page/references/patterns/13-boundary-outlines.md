# Pattern 13: Boundary outlines as a reference layer

## Job

Draw the outlines of a Boundary Dataset (Regionen, Gemeinden) under a data layer, so the reader sees where points lie. The outlines carry no data: no fill, no tooltip.

Instance Page (proven): `patterns/instances/13-boundary-outlines/`: the Sportanlagen points of `dvs_awt_educ_20251002` over the Region outlines `dvs_awt_regi_20250211`. It passes the verifier clean at every width.

## Widgets

`ods-map`, two `ods-map-layer`s, one `ods-dataset-context` with `datactx` and `geoctx` (`widgets/map.md`). The Boundary Dataset comes from `boundary-catalogue.md`.

## Snippet

```html
<ods-dataset-context context="datactx, geoctx"
    datactx-dataset="{dataset_id}"
    geoctx-dataset="{boundary_dataset_id}">
  …
  <ods-map location="8,46.75,9.6" scroll-wheel-zoom="false" toolbar-geolocation="false" toolbar-drawing="false">
    <ods-map-layer context="geoctx" display="categories" color="#6B6B6B"
        shape-opacity="0" border-color="#6B6B6B" border-size="1.5" tooltip-disabled="true"></ods-map-layer>
    <ods-map-layer context="datactx" display="categories" color="#2D2D8A" size="6" tooltip-disabled="true"></ods-map-layer>
  </ods-map>
</ods-dataset-context>
```

## Pitfalls

- **Layer order.** Layers are drawn in document order: the outlines come first, the data after them. A reference layer placed last hides the data.
- **No fill.** `shape-opacity="0"` with a `color` keeps the shapes invisible but clickable, so also set `tooltip-disabled="true"`. The default `shape-opacity` is 0.5 and would tint the map.
- **Grey outlines**, `#6B6B6B`, so they do not compete with the data colours.
- **Use a catalogue entry.** Outlines of a dataset outside `boundary-catalogue.md` go through the deliberate add step.
- **Outlines are not a join.** For colouring by value use Pattern 9. The key-coverage check does not apply to an outline layer.
- The outlines count as features for the `map-no-features` signal: a map with outlines but no data layer is not flagged. Check the data layer's filter yourself.
- Do not use `join-context`.

## Source Example Page

NASAK- und KASAK-Sportanlagen Katalog (`page_examples/NASAK- und KASAK-Sportanlagen Katalog/`): the `municipalities` and `regions` layers (`display="auto" tooltip-disabled="true"`) under and over the `katalog` layer. The Example uses portal blue; the outlines here are CI grey.
