# Page-editor probe: checklist

Throwaway assets for the ticket "Probe the page editor: what it strips on save and how language slots behave". Never merged.

Use an **unpublished throwaway Page** with slug **`probe-editor`**, and delete it when done.

## 1. Sanitising (HTML + CSS fields)

1. In the data.gr.ch back office, create a new code-editor Page, slug `probe-editor`, title "Editor-Probe". Don't publish it.
2. In the **German** slot, paste `index.html` into the HTML field and `stylesheet.css` into the CSS field. Leave every other language slot empty.
3. Save, then **reload the editor**. Copy both fields back out exactly as stored (this is the ground truth; the rendered page can't tell "stripped" from "kept but inert").
4. If save fails with another validation error, copy the message verbatim, remove the offending probe, and retry; each rejection is a result.
5. Send me both stored texts (or diff them against the originals). I'll fill in the table below from them.
6. Open the preview / `https://data.gr.ch/pages/probe-editor/?headless=true` while logged in. Note which boxes are red and which are green, at full width and at < 720px (devtools device mode), and how tall the PROBE-36 map is (250px = override works, 400px = it doesn't).

| Probe | What it tests | Kept in stored source? | Rendered result |
|---|---|---|---|
| PROBE-00 / CSS-00 | comments in HTML / CSS | | |
| PROBE-01 | `<script>` | **Rejected on save** (inline; only script tags pointing to trusted remote scripts allowed) | n/a |
| PROBE-02/03 | `onclick`, `onmouseover` | | |
| PROBE-04 | `<img onerror>` | | |
| PROBE-05 | `javascript:` link | | |
| PROBE-06 | `<iframe>` | | |
| PROBE-07 | inline `<svg>` | | |
| PROBE-08 | `<form>` | **Rejected on save** | n/a |
| PROBE-09–11 | `<input>`, `<select>`, `<button>` (outside a form) | | |
| PROBE-12 | `<style>` in the HTML field | **Rejected on save** (validation error, see ticket) | n/a |
| PROBE-13 | `style="…"` attribute | | |
| PROBE-14 | custom property in `style="…"` | | |
| PROBE-15 | `calc()` in `style="…"` | | |
| PROBE-16 | `<details>` | | |
| PROBE-17 | `<object>` | | |
| PROBE-18 | `<link rel=stylesheet>` | | |
| PROBE-19–21 | `ng-init`, `{{ }}`, `ng-if`, `ng-class`, `ng-click`, `ng-model` | | |
| PROBE-root | `data-*`, `aria-*` | | |
| PROBE-30 | `:root` custom property (CSS field) | | |
| PROBE-31 | `calc(var(--target-height) …)` | | |
| PROBE-32 | `@media` | | |
| PROBE-33 | `@font-face` (needed for Eudoxus Sans) | | |
| PROBE-34 | `@import` | | |
| PROBE-35 | `>` and `:not()` selectors | | |
| PROBE-36 | `.odswidget-map` `min-height` override | | |

## 2. Language slots

With only the German slot filled:

1. In the editor, what do the other slots (fr, it, en = Romansh) show: empty, a copy of German, or something else?
2. Open each URL in a **private window (logged out is fine only if the Page is published; otherwise stay logged in and note your profile language)** and note what each shows (German content / empty page / error):
   - `https://data.gr.ch/pages/probe-editor/?headless=true`
   - `https://data.gr.ch/pages/probe-editor/?headless=true&flg=de-ch`
   - `https://data.gr.ch/pages/probe-editor/?headless=true&flg=de`
   - `https://data.gr.ch/pages/probe-editor/?headless=true&flg=fr`
   - `https://data.gr.ch/pages/probe-editor/?headless=true&flg=it`
   - `https://data.gr.ch/pages/probe-editor/?headless=true&flg=en`
3. If the Page must be published for the logged-out check: publish it briefly with restricted visibility if the back office allows it, otherwise skip the logged-out check and say so.

## 3. Sharing tab

Note the size options in the editor's **Sharing** tab verbatim (a screenshot is fine), plus the embed snippet it generates.

## 4. Clean up

Delete the `probe-editor` Page.
