# DS kit contract

Generated from one cl-strategy commit by `./scripts/run-gates.sh ds-kit --out <dir>`. Consumers commit the output and never generate it. Treat every file as read-only.

**Vendored location.** A consumer repository keeps the generated kit as a vendored folder, like `node_modules`, for example `vendor/ds-kit/`. `<kit>` in every command means that folder. Regenerate it from cl-strategy; never edit it in place.

| File | Use |
|---|---|
| `ds-foundation.css` | Tokens for light and dark, typography, colour ramps, spacing, radii, elevation. Theme switches with `data-ds-theme` on `<html>`. Also provides `.dsk-root`, the DS page base (body typography, colour, font smoothing, surface); put it on `<body>`. |
| `ds-components.css` | Styles for every snippet. Include once. |
| `fonts/` | Font files that `ds-foundation.css` references. |
| `icons/` | Icon files plus a name index; look an icon up by name, never draw one. |
| `snippets/<component>/<variant>--<state>.html` | Real rendered DOM for one variant in one user-visible state. Pseudo states are classes: `.is-hover`, `.is-focus-visible`, and similar. |
| `gallery.html` | Visual index of every snippet; the comparison target for renders. |
| `docs/` | `DECISION_MATRIX.md`, `PATTERNS.md`, `DATA_VIZ_GUIDANCE.md` and `theming.md`, copied verbatim from the DS docs. |
| `bin/ds-kit.mjs` | The CLI below. |
| `skill/ds-design/` | This skill. |
| `manifest.json` | Source commit, per-file hashes, and per component its variants, states, uncaptured states and `@status`. |

## Rules for reading the manifest

- **Commit:** record the source commit in the mockup. Two mockups on one board should share a commit; if they differ, say so.
- **Hashes:** before shipping, confirm the kit CSS you inlined matches the manifest hash. A mismatch means a hand-edited kit: stop and ask the DS owner for a fresh kit.
- **Uncaptured states:** a state listed as uncaptured has no snippet. Do not fake it by editing another snippet. Use the nearest variant of the same component in the same state and list the gap in the hand-off. If none exists, escalate before using anything; never strip state classes such as `loading` from a snippet to make it usable.
- **`@status`:** records where a component sits in the design-and-build process. It is never a reason to avoid a component (only `deprecated` is). Report it in the hand-off when a mockup depends on a `placeholder` or `preview` component.

## Using snippets

- Copy the snippet DOM as is: tag names, classes, attributes and ARIA. These adaptations are allowed, and each is recorded in the hand-off:
  - text content and data;
  - `id`/`for` pairs that must stay unique, and `href` or `aria-label` values;
  - swapping the outer or title element for the semantic tag the page needs (for example a heading for a card title `span`), or adding `role` and ARIA attributes for the same purpose, keeping the classes;
  - ARIA labels and values set to the prototype's content;
  - dropping a built-in text part that duplicates the prototype's content (next bullet);
  - omitting an optional part the prototype has no content for.
- **Snippet and content conflicts.** Keep the snippet's structure and classes. The prototype's content replaces the snippet's sample content. Drop a built-in text part (for example a progress bar's value text) only when the prototype shows the same information visibly, so it is not shown twice ("40% 40%"). Anything else that needs a change to snippet structure goes to the hand-off as a judgment mapping or kit gap.
- Pseudo-state classes show a state in a static mockup. For a live interactive mockup, use the base state and let the browser provide hover and focus.
- Wrapping layout (grid, flex, gaps) is yours: build it from `--ds-*` spacing tokens on your own classes, never on kit classes.

## CLI helpers

Run from anywhere as `node <kit>/bin/ds-kit.mjs <command>`, passing the kit folder with `--kit <kit>`. One-time setup: `npm install --prefix <kit>`, then `npx --prefix <kit> playwright install chromium` (`node_modules` is gitignored in the kit). A missing dependency makes the CLI exit with that fix. `playwright install` can remove other cached Playwright browsers it considers unused, so run it only when the CLI reports a missing browser.

- **Browser libraries.** On a machine without the system libraries Chromium needs (the error names a file such as `libnspr4.so`), point `DS_KIT_BROWSER_LIBS` at a folder holding them. The CLI prepends it to `LD_LIBRARY_PATH` for its own browser.
- **Ad-hoc scripts.** A render script run outside the CLI does not read `DS_KIT_BROWSER_LIBS`: export `LD_LIBRARY_PATH` yourself before running it. Import Playwright as `@playwright/test`, not `playwright`, resolved from the kit:

  ```js
  import { createRequire } from 'node:module';
  const { chromium } = createRequire('<kit>/package.json')('@playwright/test');
  ```

- `tokenize <in.html> --kit <dir> --out <out.html> --report <report.json> [--mode adopt|preserve] [--source-theme light|dark]`
  - `adopt` (default) maps colours by **usage role** (page, surface layers, text, borders, focus, brand, status) to DS semantic tokens, so the mockup takes on the DS look and switches theme. Sizes, radii and font sizes snap to the DS scale and replace the literal; snaps beyond the limit are listed as `far`. Far colour matches stay literal and are listed. Every decision is listed with a confidence; mixed or unknown roles stay literal.
  - **Page setup (adopt mode).** `tokenize` links `ds-foundation.css` and `ds-components.css` from the kit, sets `data-ds-theme`, rewrites an existing `color-scheme: dark` declaration to `light dark` when the source theme is dark (it never adds one: add `color-scheme: light dark` yourself when the page has none), adds `dsk-root` to `<body>` and the `ds-kit-commit` meta when absent, and lists what it applied in the report under `setup`. The links are relative to `--out`, so moving the output file breaks them: pass `--kit-href <href>` to write the link base you need, or run `inline` for the final file. The visible kit-commit line stays yours to add.
  - `preserve` keeps the original look, using the nearest token within hue, chroma and distance limits, and flags far matches.
  - Bundled JavaScript is report-only; it is never rewritten.
- `coverage <in.html> --kit <dir> --out <coverage.json|.md> [--steps screens.json]` renders light and dark and reports:
  - kit, custom (`data-ds-custom`) and unclassified elements;
  - attributed contrast failures, labelled "DS token pair below AA" when the DS pair itself fails;
  - advisory asset-contrast warnings and unverified text over gradients;
  - leftover literals, the kit pin and the page setup.

  Use `--steps` to visit every screen of a multi-screen prototype. Besides clicks and `wait` selectors, a step can be `{ "waitForIdle": true }` (wait for animation and network to settle) or `{ "sleep": <ms> }`. Use them before screens that stream or animate, so contrast is measured on settled frames. Coverage runs with reduced motion; `--motion full` opts out.
  - Coverage measures the first viewport by default; elements below the fold are not counted. Add one step per section below the fold, using the `{ "scroll": "<selector>" }` step to bring it into view, or pass `--full-page` to measure the whole page. `--full-page` extends the scope vertically only: content parked left or right of the viewport, such as a closed off-canvas drawer, stays excluded, so bring horizontally scrolled regions into view with a `scroll` step.
  - The report shows an instance-level coverage figure next to the node-level one, so deep snippets (table, Cooper panel) do not outweigh simple ones.
  - An element with a `data-dsk-*` attribute that matches no snippet is reported as "claimed kit, no signature match" and does not count as kit. A standalone `ds-icon` counts as kit.
  - Elements marked `data-ds-custom="prototype-only"` are reported separately and excluded from the coverage denominator.
- `jsx <snippet-file> --out <file> [--component <Name>]` converts a snippet to a React function component (`className`, `htmlFor`, style objects, camelCase SVG attributes). Inline `on*` handler attributes stay strings: remove them and wire behaviour in React. `--out` is required. Usage errors exit 2; `--help` lists every option.
- `inline <in.html> --kit <dir> --out <out.html> [--report refs.json] [--strict]` embeds the kit CSS, fonts and icons, verifies hashes against the manifest, and lists remaining external references. `--strict` fails if any remain.

If a command is missing or fails, report the error and do not fall back to restyling by eye. The fallback is a manual, listed pass: replace values with tokens by lookup in `ds-foundation.css`, and say in the hand-off that the mechanical step did not run.
