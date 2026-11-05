# Migrate mode

Use for an existing mockup, prototype or board that does not use the kit.

## 0. Prepare

- Keep the original untouched; work on a copy and write results beside it.
- Record the kit commit and put the pin in the copy.
- If the file is a bundled build (minified React, a single file from a bundler), prefer editing the source project and rebuilding. If only the bundle exists, follow [bundled prototypes](bundled-prototypes.md).

## 1. Tokenize (mechanical)

Run `tokenize` (interface in [kit contract](kit-contract.md)). Then read the report:

- Accept mappings with a small distance.
- Far colour matches stay literal and are flagged, not forced. Put each in the hand-off list. Do not nudge a value to make it match.
- Far size, radius and font-size snaps are already applied. Review each in the report; if the snapped size changes the design, revert it to the literal and list it in the hand-off.
- Colours with no ramp equivalent (brand art, illustration) stay and are listed.
- Mixed or unknown roles stay literal in the output, so the file is not done yet. Resolve each listed property (for example dark-only literals in `:root`) by lookup in `ds-foundation.css`, pick the token for its role in both themes, and record each as a judgment mapping in the hand-off.

## 2. Component pass

For each control, card, table and chart in the output:

1. Name the DS component with the decision matrix ([component selection](component-selection.md)).
2. Replace the markup with the snippet in the right variant and state. Keep text, data, ids, event hooks and layout intent.
3. Delete the old rules that styled it, by the method in [bundled prototypes](bundled-prototypes.md) step 6: list the non-kit classes on every kit element, then remove each class and the rules only it used. Leftover overrides on a snippet are a rule 1 violation.
4. If no component fits after the ladder, or the kit has no snippet for it, build it from kit tokens only, mark it `data-ds-custom="<reason>"`, and add it to the list.
5. Mark demo controls, persona pickers and simulated hand-off dialogs `data-ds-custom="prototype-only"` and leave their look alone ([kit contract](kit-contract.md)).

Work region by region. Cards and tables with repeated rows: replace the row template once and keep the data binding.

## 3. Measure

Run `coverage` on the result. Resolve contrast failures: usually by choosing the right surface and text token pair, never by darkening a value by eye. Render before and after in light and dark at the same widths and compare them side by side.

A source with one theme (for example dark only) becomes theme-responsive in adopt mode. Default it to follow `prefers-color-scheme`, with a small toggle that stores an override in `localStorage` and is marked `data-ds-custom="prototype-only"`. List the theme change as a behaviour change. Remove `color-scheme` values that pin the source theme.

## 4. Hand off

Give a person the leftovers: custom elements, far token matches, judgment mappings, uncaptured states, and any behaviour that changed. Use the template in [done and escalation](done-and-escalation.md).

Rerun tokenize and coverage after the component pass; the second tokenize pass should change little.
