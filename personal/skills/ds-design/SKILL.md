---
name: ds-design
description: "Alpha: tried on few real mockups so far. Make or migrate design mockups (single HTML files, Studio mockups, WhatBuild boards) so they use the real DS look through the generated DS kit: kit snippets for components, kit tokens for everything else. Create mode builds from snippets; migrate mode runs the ds-kit tokenize and coverage commands, then a component pass, then hands judgment calls to a person. Not for Angular app work; in cl-strategy that is the ds-design-system skill."
---

# DS mockups from the DS kit

> **Alpha.** This skill and the DS kit have been tried on only a few real mockups. Expect gaps; report anything that goes wrong to the DS owner and list it in the hand-off.

A mockup gets the real DS look by using DS output, never by restyling by eye. The **DS kit** is generated from a cl-strategy commit and committed by its consumers. This skill sits inside it, at `<kit>/skill/ds-design`. Use it for every mockup, new or migrated.

Real Angular work in cl-strategy's `apps/ui` (`ri`, `ds-demo`, `libs/ds`) is not this skill: use that repository's `ds-design-system` skill, then `ds-craft`. Syncing mockups with RI pages is future work and out of scope here.

## Rules

1. **Never hand-style a DS component.** No restyled buttons, inputs, cards, tables or charts, and no overrides of kit CSS.
2. **Components come from `snippets/`, everything else from tokens.** Copy the snippet for the variant and state you need. Layout, custom text and spacing use `var(--ds-*)` from `ds-foundation.css`; never a hex, `rgb()`, px font size or legacy colour variable.
3. **Pin the kit.** Read `manifest.json` and record its source commit in the mockup (`<meta name="ds-kit-commit" content="<sha>">` plus a visible line in the notes or footer). Do not mix files from two kits.
4. **Stand alone.** Inline `ds-foundation.css` and `ds-components.css` (and base64 or relative `fonts/` and `icons/`), or ship the kit folder beside the file. Open the file with no server and no network. Every page uses `<html lang="en" data-ds-theme="…">` and `<body class="dsk-root">`.
5. **Do not invent components.** If nothing fits after the ladder in [component selection](references/component-selection.md), or `manifest.json` has no snippet for it, build it from kit tokens only, mark it `data-ds-custom="<reason>"`, list it in the hand-off and escalate it. Draw no outline on custom regions unless the person asks for one; then add one rule: `[data-ds-custom]:not([data-ds-custom="prototype-only"]) { outline: 1px dashed var(--ds-border-warning); }`. Demo controls, persona pickers and simulated hand-off dialogs use the reason `prototype-only`, keep their own look, and are exempt from the token rules in the done checklist.
6. **Keep supplied content.** Labels, data, routes and behaviour stay as given unless the brief changes them. Simulated actions stay clearly simulated.
7. **Do not edit the kit or the DS source** for a mockup. A kit gap is reported, not patched. Do not start servers or publish without authorization.

## Get the kit

Kit location (`<kit>` below): this skill sits at `<kit>/skill/ds-design`, so the kit is two folders up. Otherwise ask for it, or find the committed copy (a folder holding `manifest.json` and `ds-foundation.css`). Generation is only possible inside cl-strategy (`./scripts/run-gates.sh ds-kit --out <dir>`); anywhere else, ask the DS owner for a kit. Never copy a kit from another mockup of unknown age. If `manifest.json` is older than the task needs, say so and ask the DS owner for a newer kit. Details and the file contract: [kit contract](references/kit-contract.md).

## Create mode

Full procedure: [create mode](references/create-mode.md).

1. For each UI need, choose the component with [`DECISION_MATRIX.md`](../../docs/DECISION_MATRIX.md) ([selection notes](references/component-selection.md)). Check `manifest.json` for its variants, states and `@status`.
2. Compose the page from `snippets/<component>/<variant>--<state>.html`, using the state a user actually sees. Pseudo states are classes such as `.is-hover`; use them only to show a state, never as styling.
3. Use the kit's page setup: `<html lang="en" data-ds-theme="light|dark">` and `<body class="dsk-root">`. `.dsk-root` supplies DS body typography, colour, font smoothing and page surface; without it, snippets render with the wrong text.
4. Render, then compare each component with `gallery.html` in both themes.
5. Fill the hand-off ([done and escalation](references/done-and-escalation.md)).

## Migrate mode

Full procedure: [migrate mode](references/migrate-mode.md).

1. **Tokenize (mechanical).** Run the command below, then read the report. Adopt mode (the default) maps colours by role so the mockup takes on the DS look; mixed or unknown roles stay literal and are listed. Resolve each by lookup in `ds-foundation.css` and record it as a judgment mapping for step 4.

```bash
node <kit>/bin/ds-kit.mjs tokenize <in.html> --kit <kit> --out <out.html> --report <report.json>   # --mode adopt (default): take on the DS look
```

2. **Component pass.** Map each control, card, table and chart to a snippet via the decision matrix. Replace the markup, keep the content and data. Bundled React or Vite prototypes: patch the shared components ([bundled prototypes](references/bundled-prototypes.md)). Charts follow [`DATA_VIZ_GUIDANCE.md`](../../docs/DATA_VIZ_GUIDANCE.md).
3. **Measure.** Run `coverage`, then render before and after in light and dark. List the prototype classes still on kit elements and remove them.

```bash
node <kit>/bin/ds-kit.mjs coverage <out.html> --kit <kit> --out coverage.md --steps screens.json   # --steps for multi-screen prototypes; steps accept waitForIdle, sleep and scroll; the first viewport is measured unless you add a scroll step per section below the fold or pass --full-page
node <kit>/bin/ds-kit.mjs inline <out.html> --kit <kit> --out standalone.html --report refs.json
```

4. **Hand off** the leftovers and judgment calls to a person.

Order matters: tokenize first so the component pass starts from clean values; rerun both commands after the component pass.

## Done

Done means: kit pinned and recorded, standalone file, coverage report has no unexplained custom elements and no contrast failures, light and dark renders checked, and the hand-off lists every custom element, flagged token match and judgment call. The full checklist and the cases that must go to a person are in [done and escalation](references/done-and-escalation.md).

## References

- [Kit contract](references/kit-contract.md): files, manifest fields, what each CLI command reads and writes.
- [Component selection](references/component-selection.md): matrix use, chart, Cooper and layout notes, what to do when nothing fits.
- [Create mode](references/create-mode.md) and [migrate mode](references/migrate-mode.md): detailed steps.
- [Bundled prototypes](references/bundled-prototypes.md): migrating React and Vite builds through their shared components.
- [Done and escalation](references/done-and-escalation.md): checklist, hand-off template, escalation list.
- [Worked examples](references/examples.md): one short example per mode.
