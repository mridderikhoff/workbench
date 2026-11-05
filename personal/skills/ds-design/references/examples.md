# Worked examples

Excerpts only. File names follow `snippets/<component>/<variant>--<state>.html`; the default state is `--default`. Read the exact names from `manifest.json`.

## Create: a card with a primary action

Need: a summary card with a save action. Matrix: card for the container, button (primary) for the action.

```html
<html data-ds-theme="light">
<head>
  <meta name="ds-kit-commit" content="a1b2c3d">
  <style>/* ds-foundation.css and ds-components.css inlined here */</style>
  <style>
    .layout { display: grid; gap: var(--ds-sys-space-gap-200); padding: var(--ds-sys-space-padding-300); }
  </style>
</head>
<body class="layout">
  <!-- snippets/card/default--default.html -->
  <!-- snippets/button/primary--default.html -->
  <p class="note">DS kit a1b2c3d</p>
</body>
</html>
```

Paste the real snippet DOM where the comments are, change only its text, then render in light and dark and compare with `gallery.html`.

## Migrate: a hand-made button and hard-coded colours

Before:

```html
<button style="background:#1f6feb;color:#fff;border-radius:6px;padding:8px 14px;font:600 14px Arial">Save</button>
<div style="color:#667085">Updated 2 days ago</div>
```

Step 1, `tokenize`, turns the loose values into tokens and reports each distance. Step 2 replaces the hand-made button entirely, since it is a DS component:

```html
<!-- snippets/button/primary--default.html, text changed to "Save" -->
<button class="..."> Save </button>
<div style="color:var(--ds-text-secondary);font:var(--ds-sys-typography-body-m-regular)">Updated 2 days ago</div>
```

Step 3, `coverage`, then lists the button as a kit snippet and the text as tokenized. If a banner used a colour 40 away from any ramp token, the report flags it, and it goes to the person in the hand-off rather than being nudged to the nearest token.
