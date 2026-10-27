# Design guide: workbench dev tools

Dev tools in this repo should be **fun first**. They're tools I look at all day, so they get to have
personality: printed ink on real objects, pulpy horror-poster energy, little moments of delight.
**Maximalism is welcome**: more flourishes, more effects, more texture, as long as status still
scans instantly. Fun never costs legibility, speed or accessibility.

The Overseer dashboard (`bin/qa-dashboard`) is the reference implementation. When in doubt, match it.

## The animated character comes first

An expressive, animated character (the halftone eye) is the heart of Overseer. The animated character is a focal
part of the experience, not a decorative footer or just another status icon. Give it a deliberate
place in each scene and protect its presence as the session list grows.

- A **scene** determines the composition: layout, surfaces, and where the character and sessions
  live. Overseer has one scene, **Desk**; retired scenes and future ideas live in
  [the scene notebook](docs/SCENE_IDEAS.md).
- A **theme** supplies the visual world: palette, materials, typography, icons, and character.
  Scenes should translate across worlds such as horror, cyberpunk, classic Mac, and science fiction.
- The character need not be an eye. An avatar, creature, or machine can take its place. Preserve
  the pleasure of deliberate marks, expressive animation, and responsive interaction rather than
  copying the eye's anatomy into every theme. A theme may also re-ink the same character instead of
  drawing a new one, as Neon does.
- Character animation can remain alive when services are healthy. Keep status signals clear and
  distinct from the character's personality; neither should depend only on colour or motion.

## Make the interface belong to its scene

Take inspiration from [Obra Dinn's logbook](https://dukope.com/devlogs/obra-dinn/tig-37/): give the
interface a coherent place in its world. In Desk, every panel is an object lying on a real desk: the
eye card is taped down, the backend card is an index card or an acrylic plate, pills are tags or
keycaps. Avoid ordinary floating cards pasted over unrelated artwork.

Use this within reason: this is a developer workspace. Keep information scannable, actions plain,
and controls familiar. Never add fictional meters, pretend controls, or cumbersome navigation just
to complete a metaphor. The art is here to bring play and joy to the workday, not to turn routine
development into a game or a task to optimize. Leave room for the owner's taste and experiments.

Current scene scope is **Desk only**. Book and Console were tried and retired (the pixel-plate look
was overboard, and the book spread was too wide); their notes and other scene ideas live in
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

### 2. Printed ink on real objects
- **Panels are physical objects**: card stock, acrylic, a brass-eyeleted tag, a ledger card, an LED
  plate. Give them visible edge thickness, a contact shadow, texture, controls sunk into the
  surface and headings pressed in. A second sheet may peek out underneath. Status cards stay square
  and on the grid; the character's card may tilt, be taped or stickered down, torn or dog-eared.
- **The surface is real too**: a leather blotter on black velvet, brushed metal, a cutting mat. Light
  falls on it (a candle pool, a neon tube off-screen) and fades towards the edges, so the objects sit
  on it convincingly. Keep the surround quiet (no panelling or busy pattern) so the work area owns
  the eye.
- **Props match the character.** Margin props (candles, a floppy disk) are screened into the same
  halftone dots as the eye, flames and glow included, rather than drawn as realistic illustrations.
- **Ink goes where a hand would make a mark**: the halftone character, brush underlines, seeded
  dividers, rubber stamps, a seal, a single drip, the seep on a pill. Keep that mark language
  consistent within a scene: don't mix smooth vector icons with pixel glyphs and brush ink at random.
- **Two-ink printing is welcome**: a theme may overprint a second spot ink slightly off register.
- **Popups belong to the same world**: same materials, lifted higher with a bigger shadow, fields
  sunk in, buttons that press down, a plain dim behind them. Select lists open as a popup of the same
  material (the customizable `appearance: base-select`, with a styled native select as the fallback);
  keyboard and screen-reader behaviour stays native.
- **Settings rows line up**: one label column, the same field height and row gap everywhere, groups
  split by a dashed rule, and Done at the bottom right (full width on a phone, where labels stack above
  fields).
- The **halftone character** keeps a fixed dot grid and a limited ramp (4–6 colours from the
  theme). Mounts and props use the same dots: Blood's candles are screened into them, and Neon's
  hazard tape breaks up into halftone dots at its torn ends. Avoid glossy, clip-art objects.
- **Stepped animation** for the character: anything that moves position runs at about 8–12fps in whole-cell steps.
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
- Interactive moments should reward attention: an eye that follows the cursor, a pill hover that fits
  the theme (Blood: a thin wet band of blood seeps in and one drip falls, with a cooldown; Neon: a
  stepped yellow charge bar fills behind the label and the label inverts to black), a squish on press.
  Keyboard focus shows the same effect as hover, the label stays readable mid-animation, and reduced
  motion shows the end state without moving.
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
- Pre-rendered art is a performance tool: paint textures, fog and glows once per theme and scheme
  into tiles (cache them), draw small, scale up crisply, and swap pre-rendered frames.
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
  fonts, favicon variants, logo source art, palettes, status glyphs, settings icon, the desk
  (materials and props), desk art and CSS, brushstroke presets, the pill hover effect (`pillHover`)
  and eye modes. The engines (halftone grid, drips, brushstrokes, desk materials, pill hovers,
  cursor tracking) stay theme-agnostic.
- A new theme (say, Cthulhu: tentacles and an elder sign) should touch only its registry entry.
- Options belong in Settings (tenant, theme, appearance, logo animation) and persist across visits,
  applied before first paint so nothing flashes. Logo animation has exactly three options with
  generic names: **Full** (the whole animation), **Subtle** (only the slow ambient motion, such as
  drips) and **Static** (Subtle's still frame, with no loop at all). Stored values from older versions
  map to the nearest option.

### 9. The current themes
- **Blood**: candlelit horror. Card stock with foxing on a leather blotter over black velvet, a red
  wax seal, masking tape, halftone candles and smoky fog; brush-ink glyphs and blood-red ink.
- **Neon**: Cyberpunk 2077. Neon yellow `#fcee0a` is the main ink and electric cyan `#02d7f2` the
  second, on near-black acrylic and a cutting mat; hot red `#ff003c` is kept for problems so a failure
  never reads as yellow. No pink, magenta or blue. In light mode yellow fails as text on pale acrylic,
  so text is near-black, the second ink is a dark teal, and yellow stays for fills: keycap pills, the
  wordmark glow, hazard tape, the charge hover (black with yellow text there) and the LED readout.

## Prompt for agents building a dev-tool UI

Paste this when asking an agent to build or restyle a tool in this repo:

> Build this as a **fun-first dev tool** following `DESIGN.md` in the workbench repo; maximalism is
> welcome. Make panels physical objects lying on a real, textured surface (edge thickness, contact
> shadows, sunk controls, pressed-in headings), and put ink where a hand would mark: halftone art,
> brush underlines, stamps, seeded dividers. Animate the character in stepped frames (8–12fps,
> squash/stretch and smear frames) with a pulpy horror-poster attitude, and keep it SFW. Theme the **visuals only**: every word on screen stays plain and
> standard. Make the most important status the biggest, most scannable element; healthy detail is
> quiet and problems are loud. Status glyphs differ by shape, with labels beside them. No rhythmic
> pulsing of decorative art; irregular flicker or drift is fine. Hand-made imperfection: strokes
> don't end perfectly, and procedural art is seeded so it never repeats identically. Stay
> accessible (AA text, 3:1 glyphs, focus rings, keyboard, reduced motion, System/Dark/Light) and
> fast (composited properties only, no live filters, textures pre-rendered to cached tiles, canvases
> at the art's frame rate that pause when hidden, DOM rebuilt only on change). Put every themeable piece in the theme registry. Show
> screenshots in dark and light, at desktop and phone width, and report contrast and `?perf=1`
> numbers.
