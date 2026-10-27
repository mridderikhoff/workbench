# Design guide: workbench dev tools

Dev tools in this repo should be **fun**. They're tools I look at all day, so they get to have
personality: pixel art, pulpy horror-poster energy, little moments of delight. Fun never costs
legibility, speed or accessibility.

The Overseer dashboard (`bin/qa-dashboard`) is the reference implementation. When in doubt, match it.

## The animated character comes first

Expressive pixel art and animation are the heart of Overseer. The animated character is a focal
part of the experience, not a decorative footer or just another status icon. Give it a deliberate
place in each scene and protect its presence as the session list grows.

- A **scene** determines the composition: layout, surfaces, and where the character and sessions
  live. It can rearrange the interface substantially, as Book does; it is more than a background.
- A **theme** supplies the visual world: palette, materials, typography, icons, and character.
  Scenes should translate across worlds such as horror, cyberpunk, classic Mac, and science fiction.
- The character need not be an eye. An avatar, creature, or machine can take its place. Preserve
  the pleasure of deliberate pixels, expressive animation, and responsive interaction rather than
  copying the eye's anatomy into every theme.
- Character animation can remain alive when services are healthy. Keep status signals clear and
  distinct from the character's personality; neither should depend only on colour or motion.

## Make the interface belong to its scene

Take inspiration from [Obra Dinn's logbook](https://dukope.com/devlogs/obra-dinn/tig-37/): give the
interface a coherent place in its world. In Book, entries should look printed on the pages. In
Console, the animated character should inhabit a display and the controls should belong to its
panel. Avoid ordinary floating cards pasted over unrelated artwork.

Use this within reason: this is a developer workspace. Keep information scannable, actions plain,
and controls familiar. Never add fictional meters, pretend controls, or cumbersome navigation just
to complete a metaphor. The art is here to bring play and joy to the workday, not to turn routine
development into a game or a task to optimize. Leave room for the owner's taste and experiments.

Current scene scope is **Book and Console only**. Other scene ideas live in
[the scene notebook](docs/SCENE_IDEAS.md) until explicitly requested.

**Keep it SFW.** It's a work tool on a work screen. Pulpy and spooky is good; gore is not. Blood is
fine as stylised accents tied to the art (drips from the eye, brushstroke underlines, a single tear
on a status glyph). Splatter, blood-soaked surfaces and large stained backgrounds cross the line, and
so do skulls and bodies. Backgrounds stay ambient: candles, smoky grey fog, old paper.

## The rules

### 1. Theme the visuals, never the words
- Theme lives in **visuals only**: icons, typography, colour, art, texture, spacing, motion.
- **Copy stays plain and standard.** "Settings", not "Grimoire". "up 7h", not "7h alive".
  "Stop the frontends for <branch>?", not anything ominous. Labels, tooltips, aria-labels, errors,
  confirm prompts and empty states are all plain.
- A product name is not copy: "Overseer" is fine. A theme name is not copy: "Blood" is fine.
- Show less text. A commit is its hash plus "committed 2h ago"; the message goes in a tooltip.
  A path is its last folder; the full path goes in a tooltip.

### 2. Pixel art, style over realism
- Prefer **deliberate pixel art** to realistic rendering. Chunky cells on a fixed grid, scaled with
  nearest-neighbour (`image-rendering: pixelated`), hard edges.
- **Limited palette:** 4–6 colours from the theme per piece, stepped and never blended. Gradients
  are made with **ordered (Bayer) dithering** between adjacent palette steps.
- **Stepped animation:** anything that moves position runs at about 8–12fps in whole-cell steps.
  Light and brightness may step at about 24fps.
- Use the classic tricks: squash and stretch (tall while falling, wide on impact), one-frame smears
  on fast moves, a few frames of anticipation, and easing done by **holding frames** rather than
  moving by fractions.
- 2D art stays 2D. Don't fake 3D rotation of flat artwork. A coin flip goes "flat Stanley", and a
  camera orbit makes parts slide inside their outline. Bring flat art alive with edges, light,
  drips, blinks and glances instead.

### 3. Hand-made, never identical
- Strokes **don't end perfectly**: dry-brush breaks, uneven weight, small gaps and overshoots where
  the brush lifted, an occasional stray speck.
- Decorative art is **procedural and seeded**, so it never repeats exactly (the blood-stroke
  underlines are re-rolled every page load). Seed per item where stability matters (per branch, per
  pill) so nothing re-rolls while you're looking at it.
- Start from a few hand-tuned presets and jitter them, so random never means ugly.

### 4. Motion: alive, cinematic, never nagging
- Slow and continuous beats fast. No idle holds that look like the animation broke, and no sudden
  speed-ups.
- **No rhythmic pulsing** of decorative art (heartbeats, breathing, throbbing glows). Irregular,
  non-periodic motion (flicker, crawl, drift) is fine.
- Status animation is reserved for problems: a broken thing may pulse; a healthy thing is still.
- Interactive moments should reward attention: an eye that follows the cursor, a pill a thin wet
  band of blood seeps into on hover, a drip that falls once (with a cooldown), a squish on press.
- Any cursor-reactive behaviour must **release reliably**: on leaving the window, blur, a hidden
  tab or idle. Never get stuck.

### 5. Status must scan instantly
- The thing you scan for is the **biggest, clearest element** in its area: the overall rollup gets
  a large glyph, a large state word and a tinted band.
- Detail lists invert that: **healthy is quiet** (dimmed) and **problems are loud** (bright red,
  semibold, animated).
- Secondary information (being behind `develop`, hashes, "show details") is visually quiet until
  hovered. Being behind is not an error, so it is not red.
- Status glyphs differ in **shape**, not only colour, with the text label always beside them.
  Current set: open eye = running, half-open amber eye = starting or rebuilding, eye crying blood =
  running but broken, closed red eye = down, dagger = needs a human, hollow ring = unknown.

### 6. Accessible, always
- Text at WCAG AA (4.5:1) or better on every background and state; aim for 7:1 for secondary
  text. Glyphs and other meaningful non-text at 3:1 or better. Measure, and record the numbers.
- Visible focus rings everywhere, full keyboard support, native `<dialog>` for modals.
- `prefers-reduced-motion` turns off all decorative motion and leaves a good still frame.
- Appearance offers **System / Dark / Light**. Every piece of art and every palette follows the
  scheme, including canvases (re-derive cached palettes when the scheme changes).

### 7. Fast, or it isn't fun
- Pixel art is a performance tool: draw small, scale up crisply, and swap pre-rendered frames.
- Animate only composited properties (`opacity`, `transform`). No live SVG filters
  (`feTurbulence`), large blurs, `backdrop-filter` or blend modes on full-page layers: pre-render
  them to a tile once.
- Canvas loops run at the art's real frame rate (not 60fps), skip unchanged frames, avoid
  per-frame allocations, and pause when off-screen, in a hidden tab, or behind a modal.
- Rebuild DOM only when its data changed. Update ticking text in place.
- Measure with an in-page `?perf=1` logger (frame callbacks, long tasks, main-thread busy %), and
  report before/after numbers for any visual change.

### 8. Pluggable themes
- Everything themeable lives in **one registry section** (`THEMES`): colours for dark and light,
  fonts, favicon variants, header art, logo source art, palettes, status glyphs, settings icon,
  backgrounds, brushstroke presets and eye modes. The engines (halftone grid, dithering, drips,
  brushstrokes, cursor tracking) stay theme-agnostic.
- A new theme (say, Cthulhu: tentacles and an elder sign) should touch only its registry entry.
- Options belong in Settings (theme, appearance, logo animation, background) and persist across
  visits, applied before first paint so nothing flashes.

## Prompt for agents building a dev-tool UI

Paste this when asking an agent to build or restyle a tool in this repo:

> Build this as a **fun dev tool** following `DESIGN.md` in the workbench repo. Use deliberate pixel
> art (fixed grid, nearest-neighbour scaling, a 4–6 colour palette with ordered dithering, stepped
> animation at 8–12fps, squash/stretch and smear frames) with a pulpy horror-poster attitude, and
> keep it SFW. Style over realism. Theme the **visuals only**: every word on screen stays plain and
> standard. Make the most important status the biggest, most scannable element; healthy detail is
> quiet and problems are loud. Status glyphs differ by shape, with labels beside them. No rhythmic
> pulsing of decorative art; irregular flicker or drift is fine. Hand-made imperfection: strokes
> don't end perfectly, and procedural art is seeded so it never repeats identically. Stay
> accessible (AA text, 3:1 glyphs, focus rings, keyboard, reduced motion, System/Dark/Light) and
> fast (composited properties only, no live filters, canvases at the art's frame rate that pause
> when hidden, DOM rebuilt only on change). Put every themeable piece in the theme registry. Show
> screenshots in dark and light, at desktop and phone width, and report contrast and `?perf=1`
> numbers.
