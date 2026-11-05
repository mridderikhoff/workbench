# Component selection for mockups

Selection follows the same source as the Angular work. Read the section of [`DECISION_MATRIX.md`](../../../docs/DECISION_MATRIX.md) for the UI need, then confirm the component exists in the kit manifest. [`PATTERNS.md`](../../../docs/PATTERNS.md) covers composed flows such as save-with-feedback. The manifest is the component index; a mockup needs the rendered DOM from snippets, not an API.

## Ladder when nothing fits exactly

1. Use the component as is.
2. Compose snippets (a card with projected content, a status dot plus badge in a table cell).
3. Adapt content at the boundary (relabel, reformat a value). Never restyle.
4. Keep a marked custom element and list it. A near miss is not a licence to rebuild a component.

When the kit has no snippet for a component or layout piece (check `manifest.json`), build it from kit tokens only, mark it `data-ds-custom="<reason>"`, list it in the hand-off and escalate it as a kit gap. Demo controls, persona pickers and simulated hand-off dialogs are not product UI: mark the outermost element `data-ds-custom="prototype-only"` and do not restyle them into DS components.

A general-purpose primitive (button, status marker, stat tile, section container) is never a custom element.

**Known DS gaps.** List these in the hand-off instead of hand-building them: the static panel (not exported), menu items (the DS has no menu-item component), the `cooper-panel` close control and subtitle, and the Box, Package, Shield, Target and Send icons.

## Notes that apply to mockups

- **Surfaces:** page regions use the page surface, cards use the card surface, and content inside a card uses the secondary-alpha surface token. Never paint a page or card fill by hand. See [`theming.md`](../../../docs/theming.md).
- **Header chrome:** build the header from `nav-bar/default--default`, which has a logo slot and an actions slot (with an avatar button), and put `page-header/default--default` (title, breadcrumbs, toolbar with a primary action) under it. Never hand-build header chrome around the nav-bar. A static page narrower than the five items uses `nav-bar/overflow--default`.
- **Lists:** event and update lists use `activity-feed`. A row list with no snippet stays a custom element and is listed in the hand-off.
- **Navigation:** primary page navigation uses the `nav-bar` snippet. A ghost link-button snippet is for in-page links only, never a bare underlined anchor; actions are buttons.
- **Stat tiles, tables, modals, people:** a metric tile is `stat-card`, not a custom card. A table starts from `table/template--default`; its top comment explains adding rows and columns. A modal uses the `modal` snippet inside the overlay wrapper, placed as the last child of `<body>`. A person's identity is `avatar`. Take exact class names from the snippet and `manifest.json`.
- **Text:** use the typography classes or tokens (defined in `ds-foundation.css`). The `font:` shorthand alone drops letter spacing and uppercase transforms.
- **Forms:** the `form-field` wrapper is mandatory. Every value control sits in it, and its label, hint and error come from the wrapper. The standalone text-input and select snippets are never used without it. Only a kit without a form-field snippet falls back to building the label and hint from tokens, and the gap is listed. There is no required or optional marker anywhere in DS: never add `*` or "(optional)". `checkbox`, `switch` and `radio-group` sit in the wrapper when they carry a value label. Toolbar controls may sit outside it when they carry an `aria-label` and need no visible label; never repeat a label the page already shows. A menu is `action-popover` (a dialog with action buttons, inert in static HTML), a view switch is `segmented-control`, and applied filters are `chip` or `filter-tag`.
- **Status text:** emphasis text in a status colour that fails AA on its surface (warning text on the page or a card, for example) becomes a status-dot with a label in the primary text colour. Never darken the status colour by eye.
- **Icons:** look up the icon by name in the kit index; no inline SVG drawn by hand.
- **Charts:** pick the chart component per [`DATA_VIZ_GUIDANCE.md`](../../../docs/DATA_VIZ_GUIDANCE.md). Record, per chart, the chosen component, its data semantics (order, shared maximum or reference, labels, formats) and the kit commit. The kit has `bar-chart`, `ranked-bar`, `meter-bar`, `segmented-bar` (with its legend) and `timeline`. Only a chart type outside these families, with no snippet, is a custom element.
- **Chart data:** chart snippets (`bar-chart`, `ranked-bar`, `meter-bar`, `segmented-bar`, `timeline`) hold one sample dataset; the kit cannot yet build them from your data. Keep the snippet's structure, category labels and plot proportions: never set `--ds-viz-cartesian-frame-plot-aspect-ratio` or an `aspect-ratio` on a chart, and never remove its labels, even if the source hid them. For a smaller chart, narrow its container. Values you change by hand are illustrative: list each such chart in the hand-off.
- **Cooper:** the target is the assistant entry point bottom-right in a bottom bar that spans the whole viewport width, opening the Cooper panel. Build the bar from the `bottom-sheet/cooper--*` snippets inside the fixed-bottom wrapper, with `cooper-fab` as the bottom-right entry point. `cooper-button` is only for an inline "Ask Cooper" action. `cooper-panel/contained--*` needs a positioned host. Take exact class names from the snippets and `manifest.json`. Only a kit without the bottom-sheet snippet builds the bar from tokens, marked `data-ds-custom="cooper-bottom-bar: no kit snippet"`. Preserve Cooper's branded paint. If the source puts Cooper elsewhere (for example a top-bar button), move it to the target and list the move as a behaviour change. Copy that refers to the old placement (for example "click my icon on the top menu bar") is now wrong: list it as a content change and escalate it; do not reword it yourself. If moving it breaks the design, keep it where it is, mark it custom, and escalate the placement.
