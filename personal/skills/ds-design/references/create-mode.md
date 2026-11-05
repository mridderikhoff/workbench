# Create mode

Use when there is no existing mockup, or the existing one is thrown away.

1. **Brief to inventory.** List every screen region and control the mockup needs. For each, name the DS component with the decision matrix and note it in a working map: `need -> component -> snippet file`.
2. **Kit check.** Open `manifest.json`. Confirm each component, variant and state exists. Anything missing is an uncaptured state or a custom element; decide now.
3. **Shell.** Start from the page-surface snippet or class and the theme switch. Include the kit CSS inline (or relative `<link>` when the kit ships beside the file). Add the pin meta tag.
4. **Compose.** Paste snippets in order. Pick the state the viewer should see (an open select popup, a selected segment, a sorted table, an error field). Layout wrappers use your own classes with `--ds-*` spacing, radius and surface tokens.
5. **Interaction.** If the brief wants clickable behaviour, add minimal JS that toggles snippet states by swapping to the matching snippet DOM, not by adding styles. Mark simulated actions in the UI text or a note.
6. **Verify.** Render at desktop and narrow widths in light and dark. Compare each component with its `gallery.html` entry. Exercise every interactive component in its visible states (popups, disabled, focus by keyboard, empty, loading, error). A closed trigger does not prove its popup matches.
7. **Report.** Run `coverage` on the result, then fill the hand-off in [done and escalation](done-and-escalation.md).

Theme: set `data-ds-theme="light"` or `"dark"` on the root element. A theme toggle is allowed; it only changes that attribute (and `color-scheme`).
