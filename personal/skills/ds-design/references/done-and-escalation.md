# Done and escalation

## Done means

- [ ] Kit commit recorded in the file (meta tag and visible note); kit CSS hashes match `manifest.json`.
- [ ] File opens standalone, with no server and no network.
- [ ] No hard-coded colours, fonts, font sizes or radii outside the kit, except in elements marked `data-ds-custom="prototype-only"`, far colour matches and brand-art colours with no ramp equivalent (each listed in the hand-off); `tokenize` rerun shows nothing new, and every mixed-role literal it listed is resolved and recorded as a judgment mapping (migrate mode).
- [ ] Every control, card, table and chart is a kit snippet in the right state, or a marked custom element.
- [ ] `coverage` report saved with the mockup; no contrast failures; custom elements and judgment mappings match the hand-off list.
- [ ] Light and dark rendered and compared with `gallery.html` (create) or with the original (migrate). Desktop and narrow widths checked.
- [ ] Interactive states exercised, not only the closed or default view.
- [ ] Hand-off written.

## Hand-off template

```md
Kit: <commit> (<path>)
Files: <mockup>, <coverage report>, <before/after renders>
Custom elements (no DS equivalent): <element, where, why>
Prototype-only elements: <element, where>
Snippet adaptations: <snippet, change (tag swap, ARIA, dropped or omitted part), reason>
Judgment mappings: <original -> snippet, reason>
Far token matches: <value, nearest token, distance>
Uncaptured states used as stand-ins: <component, state>
Non-stable components used: <component, status (placeholder | preview)>
Behaviour or content changes: <none | list>
Kit gaps to report: <list>
```

## Escalate to a person

Stop and ask rather than deciding when:

- A component is needed and nothing fits after the ladder; report it to the DS owner.
- A far token match touches brand or illustration colour.
- A contrast failure remains after choosing the correct token pair.
- The original design contradicts the matrix (for example a custom control that carries product meaning).
- A required state is uncaptured in the kit.
- The kit looks stale, hand-edited (hash mismatch), or the CLI fails.
- Meeting the brief would need an edit to the DS source or the kit.
- Content, data or behaviour would have to change to fit a snippet.
- A kit snippet is missing for a component or layout piece the design needs.
- Cooper cannot move to the target placement without breaking the design.
- Copy refers to a placement that changed (for example Cooper moved to the bottom bar).
- An uncaptured state has no same-state variant to stand in for it.

Never resolve these by restyling, nudging colours, or deleting content.
