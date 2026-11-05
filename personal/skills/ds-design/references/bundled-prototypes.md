# Bundled prototypes (React, Vite, single-file builds)

A bundle has no template strings, only compiled component calls. Migrate it through its shared components, not screen by screen.

1. **Find a source project.** If one exists, edit it, rebuild, and skip the rest.
2. **Find the shared components.** Look for the functions that render repeated UI: button, card, tag, tabs, select, icon button, meter, empty state. Locate them through their CSS-module class maps or class names, and confirm each by its rendered output. Patch these, never individual pages: one patch migrates every screen that uses the component.
3. **Patch with a script.** Write a small script of exact-match replacements, kept beside the output. Each replacement must fail loudly: exit non-zero and name the pattern when its expected source text is not found or matches an unexpected number of times. No silent no-op replacements. Log what each replacement changed.
4. **Match the snippet root.** In React, put `class` rather than `className` on custom elements (`ds-card`, `ds-badge`), so the root tag and classes still match the snippet. Keep props, handlers and ids.
5. **Rebuild or re-run the script, then run `coverage`** with a steps file that visits every screen ([kit contract](kit-contract.md)).
6. **Remove the styles of replaced markup.** The component pass is not finished while prototype classes sit on kit elements.
   - This is a manual check; `coverage` does not report it. After the patch, render each screen in a browser and list the classes on every kit element that are not kit classes, with their declarations. Run this in the page (for example through Playwright `page.evaluate`):

     ```js
     [...document.querySelectorAll('*')]
       .filter((el) => [...el.attributes].some((a) => a.name.startsWith('data-dsk-')))
       .flatMap((el) => [...el.classList].filter((c) => !c.startsWith('ds-')).map((c) => ({ tag: el.localName, class: c })))
     ```

     Look up each class in the prototype's stylesheet for its declarations. Snippet roots without a `data-dsk-*` attribute need the same check by tag and `ds-` class.
   - For each class, read its declarations and find every use. If no replaced component uses it any longer, delete the rule. If a layout wrapper still needs part of it, keep only that part, on the wrapper, built from `--ds-*` tokens.
   - Padding, uppercase labels, hover borders and fills on a kit host are rule 1 violations. Remove the class from the host rather than overriding it.
   - Rerun the listing until it is empty, then rerun `coverage` for the other checks.
7. **Record the migration as bundle-level.** Say in the hand-off that a rebuild of the prototype invalidates the patch script, and name the script.

## Example: a runtime-rendered bundle

The bundle builds its DOM in code, so a pasted snippet cannot be used as is. Convert each snippet once, then swap in the text:

1. `node <kit>/bin/ds-kit.mjs jsx <kit>/snippets/badge/green--default.html --component DsBadge --out src/ds/DsBadge.jsx`
2. Remove any inline `on*` attributes from the output and wire behaviour with the prototype's own handlers.
3. Replace the sample text with props (`{label}`), and keep the snippet's root tag, classes and ARIA. `jsx` keeps `class` rather than `className` on custom-element roots (hyphenated tags such as `ds-card`).
4. Point the prototype's shared badge function at `DsBadge`, rebuild, and run `coverage` ([kit contract](kit-contract.md)).
