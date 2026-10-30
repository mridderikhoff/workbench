# Design guide: workbench dev tools

Dev tools in this repo should be **fun first**. They're tools I look at all day, so they get to have
personality: printed ink on real objects, pulpy horror-poster energy, little moments of delight.
**Maximalism is welcome**: more flourishes, more effects, more texture, as long as status still
scans instantly. Fun never costs legibility, speed or accessibility.

The Overseer dashboard (`bin/qa-dashboard`) is the reference implementation. When in doubt, match it.

Before any visual iteration, also read [docs/STYLISED_UI.md](docs/STYLISED_UI.md): the game-UI playbook
(the design calls we have made, a toolbox per moment, and the don'ts).

## The animated character comes first

An expressive, animated character (the halftone eye, or Terminal's halftone CRT with an ASCII face) is the heart of Overseer. The animated character is a focal
part of the experience, not a decorative footer or just another status icon. Give it a deliberate
place in each scene and protect its presence as the session list grows.

- A **scene** determines the composition: layout, surfaces, and where the character and sessions
  live. Overseer has two scenes, **Desk** and **Radio**. Radio is hidden behind a feature flag
  (`QA_FEATURES.radioScene` in `bin/qa-dashboard`, or `?scene=radio` for one visit) until it is ready; while it is off,
  a stored Radio pick falls back to Desk. Retired scenes and future ideas live in
  [the scene notebook](docs/SCENE_IDEAS.md).
- A **theme** supplies the visual world: palette, materials, typography, icons, and character effects.
  Scenes should translate across worlds such as horror, cyberpunk, classic Mac, and science fiction.
- The character need not be an eye. An avatar, creature, or machine can take its place. Preserve
  the pleasure of deliberate marks, expressive animation, and responsive interaction rather than
  copying the eye's anatomy into every theme. A theme may also re-ink the same character instead of
  drawing a new one, as Y2K does on its LCD. Terminal draws its own: a putty CRT whose ASCII face looks a cell
  towards the cursor and whose expression is the backend status.
- Character animation can remain alive when services are healthy. Keep status signals clear and
  distinct from the character's personality; neither should depend only on colour or motion.

## Make the interface belong to its scene

Take inspiration from [Obra Dinn's logbook](https://dukope.com/devlogs/obra-dinn/tig-37/): give the
interface a coherent place in its world. In Desk, every panel is an object lying on a real desk: the
eye card is taped down, the backend card is an index card or a clear cartridge, pills are tags or
keycaps. Avoid ordinary floating cards pasted over unrelated artwork.

The Sessions card is a holder: its heading sits on the face, and each session is its own object lying
on that same face below it (no shared well or inset tray), with an edge, a gutter and a shadow (Terminal: an avionics
panel slid into its own moulded bay in the putty rack, held by case screws, with an annunciator and a lamp
column that mirror its worst app status, the branch on an engraved placard, a guarded toggle as the stop switch, the apps as illuminated
push-buttons with split legends, and the commit on a small display screen in a bezel; Horror: stitched oxblood leather folios with gold foil; Y2K: a frosted shell module over its own circuit board, its halves joined by a moulded part line rather than screws, with a segmented light pipe for its status, each app a latching key beside its chip). The slot label
is attached to its session in the theme's material: Terminal prints an upright asset tag (black tape with a phosphor
readout, never tilted), Horror saddle-stitches a dark leather patch on in gold thread (upright, because
it is sewn on; only tags and stamps tilt), and Y2K pad-prints a capsule on the shell with the number in a small LCD. The session count beside the heading
is made the same way as the slot label in every theme. Sessions are separated by their gutters, not by
ink dividers, so the only line under a branch name is its hover underline.

Use this within reason: this is a developer workspace. Keep information scannable, actions plain,
and controls familiar. Never add fictional meters, pretend controls, or cumbersome navigation just
to complete a metaphor. The art is here to bring play and joy to the workday, not to turn routine
development into a game or a task to optimize. Leave room for the owner's taste and experiments.

Radio places the same character portrait beside a plain, one-sentence status line. The backend card sits alongside on wide screens, and the session cards remain below with their existing controls. Each theme gives the message plate its own material; Horror connects it to the portrait with a brass speaking tube.

The Eye owns its wordmark underline: drops land and splash on the animation's floor beneath
“Overseer”, replacing the separate brushstroke. This belongs to the character, across themes.

After a machine restart, a quiet inline panel offers **Resume sessions** and **Start fresh** for
saved sessions that are fully stopped. It previews the branches and apps, preserves keyboard
selection through polling, and uses the existing action output for progress. It never starts
anything on load. See [session recovery](docs/SESSION_RECOVERY.md) for the state and safety contract.

Book and Console were tried and retired (the pixel-plate look was overboard, and the book spread was too wide); their notes and other scene ideas live in [the scene notebook](docs/SCENE_IDEAS.md).

**Keep it SFW.** It's a work tool on a work screen. Pulpy and spooky is good; gore is not. Blood is
fine as stylised accents tied to the art (drips from the eye, brushstroke underlines, a single tear
on a status glyph). Splatter, blood-soaked surfaces and large stained backgrounds cross the line, and
so do skulls and bodies. Backgrounds stay ambient: candles, smoky grey fog, old paper.

## The rules

### 1. Theme the visuals, never the words
- Theme lives in **visuals only**: icons, typography, colour, art, texture, spacing, motion.
- **Copy stays plain and standard.** "Settings", not "Grimoire". "started 1:11 PM", not "summoned at 1:11".
  "Stop the frontends for <branch>?", not anything ominous. Labels, tooltips, aria-labels, errors,
  confirm prompts and empty states are all plain.
- A product name is not copy: "Overseer" is fine. A theme name is not copy: "Horror" is fine.
- Show less text. A commit is its hash plus "committed 2h ago"; the message goes in a tooltip.
  A path is its last folder; the full path goes in a tooltip.

### 2. Printed ink on real objects
- **Panels are physical objects**: card stock, acrylic, a brass-eyeleted tag, a ledger card, an LED
  plate. Give them visible edge thickness, a contact shadow, texture, controls sunk into the
  surface and headings pressed in. A second sheet may peek out underneath. Status cards stay square
  and on the grid; the character's card may tilt, be taped or stickered down, torn or dog-eared.
- **The surface is real too**: a leather blotter on black velvet, brushed metal, an anti-static mat. Light
  falls on it (a candle pool, a studio softbox off-screen) and fades towards the edges, so the objects sit
  on it convincingly. Keep the surround quiet (no panelling or busy pattern) so the work area owns
  the eye.
- **Props match the character.** Margin props (candles) are screened into the same
  halftone dots as the eye, flames and glow included, rather than drawn as realistic illustrations.
- **Ink goes where a hand would make a mark**: the halftone character, brush underlines,
  rubber stamps, a seal, a single drip, the seep on a pill. Keep that mark language
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
  theme). Mounts and props use the same dots: Horror's candles are screened into them, and Y2K's
  LCD casts each dot's shadow onto its reflector. Avoid glossy, clip-art objects.
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
  the theme (Horror: a thin wet band of blood seeps in and one drip falls, with a cooldown; Y2K: the LED under the key lights up through the cap, flooding it with the shell's colour; Terminal: a DOS
  block fill `▓▒░` in inverse video), a squish on press. Every button uses its theme's effect
  (`buttonHover`), not only the pills: icon buttons, Update, Show details, Done, Stop, the segmented
  control, and in Horror the select options too.
  Keyboard focus shows the same effect as hover, the label stays readable mid-animation, and reduced
  motion shows the end state without moving.
- Any cursor-reactive behaviour must **release reliably**: on leaving the window, blur, a hidden
  tab or idle. Never get stuck.

### 5. Status must scan instantly
- The thing you scan for is the **biggest, clearest element** in its area: the overall rollup gets
  a large glyph, a large state word and a tinted band.
- Detail lists invert that: **healthy is quiet** (dimmed) and **problems are loud** (bright red,
  semibold, animated). A failed build pill is the loudest thing on its card, in its theme's idiom: Horror scorches and
  tears the tag and its eye glows red, Terminal turns the key to inverse-video red with a blinking cursor, Y2K
  makes it a red clear cap with its LED blazing and its edge lit. The session card gets a red rim too.
- An app pill shows its start time as quiet secondary text (no "up 5m" counter); the title has the full time.
- An app the session could serve but does not run is a small, unlit start key with the theme's sleeping (or down) glyph
  and no time; hovering wakes it, and clicking runs `wt serve <branch> <app>` with no confirmation. Start keys cover only
  the apps the machine manages (`WT_APPS`, default `ri ds-demo`), and a session's keys follow that order; a running app
  outside the list still shows, after the others.
- Secondary information (being behind `develop`, hashes, "show details") is visually quiet until
  hovered. Being behind is not an error, so it is not red.
- Status glyphs differ in **shape**, not only colour, with the text label always beside them. Each
  theme brings its whole set (status glyphs, action icons, settings icon, chevron, favicons); none
  borrows another theme's marks.
  - Horror: open eye = running, half-open eye = starting or rebuilding, eye crying blood = running but
    broken, closed eye with a tear = down, dagger = needs a human, hollow ring = unknown.
  - Y2K (pad-printed controller marks): circle = running, triangle = starting, cross = broken,
    square = down, diamond with `!` = needs a human, `?` = unknown; a dashed circle marks an app that is not running.
  - Terminal (tiny ASCII faces): `^_^` running, `o_O` starting, `>_<` broken, `zZ` down, `O_O` needs a
    human, `?_?` unknown. The monitor's big face shows the same faces for the backend rollup.

### 6. Accessible, always
- Text at WCAG AA (4.5:1) or better on every background and state; aim for 7:1 for secondary
  text. Glyphs and other meaningful non-text at 3:1 or better. Measure, and record the numbers.
- Visible focus rings everywhere: two rings, `--focus-inner` (the surface colour) inside
  `--focus-outer` (3:1 against card and desk), so focus shows on every texture. Full keyboard
  support, native `<dialog>` for modals.
- Every solid fill has a paired on-colour (`--ok-ink`, `--bad-ink`, `--charge-ink`...), used wherever
  text sits on it. `?debug=1` runs a contrast self-check for every theme in both schemes.
- `prefers-reduced-motion` turns off all decorative motion and leaves a good still frame.
- Appearance offers **System / Dark / Light**. Every piece of art and every palette follows the
  scheme, including canvases (re-derive cached palettes when the scheme changes).

### 7. Fast, or it isn't fun
- Pre-rendered art is a performance tool: paint textures, fog and glows once per theme and scheme
  into tiles (cache them), draw small, scale up crisply, and swap pre-rendered frames.
- Transitions use the motion tokens (`--dur-fast`, `--dur`, `--ease`, `--ease-out`); one
  reduced-motion override zeroes them. Stepped effects keep `steps()` timing.
- Animate only composited properties (`opacity`, `transform`). No live SVG filters
  (`feTurbulence`), large blurs, `backdrop-filter` or blend modes on full-page layers: pre-render
  them to a tile once.
- Canvas loops run at the art's real frame rate (not 60fps), skip unchanged frames, avoid
  per-frame allocations, and pause when off-screen, in a hidden tab, or behind a modal.
- Rebuild DOM only when its data changed. Update ticking text in place.
- Measure with an in-page `?perf=1` logger (frame callbacks, long tasks, main-thread busy %), and
  report before/after numbers for any visual change.

### 8. Pluggable themes
- Features, structure and behaviour are shared by every theme. Add a feature in shared markup and logic, with CSS tokens for its materials; never branch on the theme to add or remove a control, status detail or interaction.
- A theme supplies materials only: colours, type, textures, glyphs, character art and board tiles. Shared components have complete default styles from `BASE` tokens; a new theme should touch only its registry entry.
- Everything themeable lives in **one registry section** (`THEMES`): colours for dark and light,
  fonts, favicon variants, logo source art, palettes, status glyphs, settings icon, the desk
  (materials and props), desk art and CSS, brushstroke presets, the pill and button hover effects
  (`pillHover`, `buttonHover`) and effects selected for each character. Character renderers own anatomy and expression. The engines
  (halftone grid, drips, brushstrokes, desk materials, hovers, cursor tracking) stay theme-agnostic.
- A theme's colours merge over `BASE`, which lists every engine key with a default. New keys derive
  borders and hover fills from the text colour (`color-mix`) rather than hand-picking. On `?debug=1`
  a startup check logs any key, icon or art a theme is missing, and any icon it shares with another.
- A new theme (say, Cthulhu: tentacles and an elder sign) should touch only its registry entry.
- Options belong in Settings (tenant, theme, shell colour for a theme that comes in colours, Overseer, layout, appearance,
  logo animation) and persist across visits,
  applied before first paint so nothing flashes. A field with only one available value is not shown (Layout, while
  Radio is behind its flag). Logo animation has exactly three options with
  generic names: **Full** (the whole animation), **Subtle** (less ambient motion with no cursor tracking) and **Static** (Subtle's still frame, with no loop at all). Stored values from older versions
  map to the nearest option.
- The Overseer choices are labelled **Blip** and **Eye**. Blip is the global initial and fallback;
  a valid query override wins, then a valid saved choice. Invalid queries leave the saved choice in place.

### 9. The current themes
Terminal is the default for a first visit; a stored choice always wins (a stored "blood" becomes Horror, a stored
"neon" or "clear" becomes Y2K).
- **Terminal**: a curved phosphor CRT in a putty bezel, with baked scanlines, glow and vignette,
  a rolling refresh band and occasional flicker. Blip is the global default. Its pupils look towards
  the cursor, and it blinks, winks, glances and smiles with irregular timing. Its CRT keeps the refresh band, flashes and static warble.
  Eye and Blip can be selected in any theme. Horror gives Blip ink horns, and Blip has no drips in any theme. Putty plastic panels have moulded edges and vent slots,
  with a felt pad on a wooden desk, pressing keycaps, LED legends and embossed label tape.
  The slots in use read as "3/8" on a small mechanical odometer, red only when every slot is taken; Stop is a small amber power key.
  Phosphor green `#33ff66` and amber `#ffb000` appear only on dark glass or in dark mode; light mode
  uses dark inks on putty. Problems are a clear red.
- **Horror**: candlelit horror. Card stock with foxing on a leather blotter over black velvet, a red
  wax seal, masking tape, halftone candles and smoky fog; brush-ink glyphs and blood-red ink.
  A session's status is the thread of a saddle-stitched seam down its folio, sealed with wax at the top: dark when healthy, gold
  for a warning, red for a problem, and a needle running down it while loading. The backend's screens are tooled leather labels
  and its details an aged paper slip; the slots gauge is a brass pocket watch and Stop a brass stud.
  The Update button is a manila tag with the behind count stamped on it in sepia.
- **Y2K**: late-90s see-through electronics (Game Boy Color, the GBA SP, the clear PS1 controller, the iMac G3). Every
  panel is a tinted, frosted shell over a real circuit board, seen soft and dimmed through it (the blur is baked into the
  pre-rendered SVG tiles, never live): green solder mask in the sessions and the handheld, a black motherboard in the cases,
  with ICs carrying pad-printed part numbers, SMD passives and crystals. There are no screws on any face (a Game Boy's are all
  on the back); each shell's halves meet at a moulded part line, a 1px groove about 6px in from the edge with a lit lip under
  it. The board mirrors real state: a running app is a chip beside its key, a stopped one an empty socket, an app the session
  does not serve a bare footprint. A session's status is a frosted light pipe (after the GBA SP's power light): a slim bar
  split by dark ribs into a cap and three segments, milky when unlit, filled with one hue when lit, its glow bleeding into
  the frost; while something starts, one lit segment steps down the bar. Buttons are solid, opaque caps standing proud in
  moulded wells, with a domed top, a side wall, a cast shadow and a collar, in one family: primary actions are wide pills,
  apps and options are squarer latching keys (raised when off, latched down when running or chosen), small utilities are
  slim START/SELECT capsules, and Stop is a round domed cap like the A and B buttons in deep, muted red plastic (the loud
  reds belong to status), with only a faint square moulded into it. Legends are heavy and full-strength, 7:1 or better on the caps.
  The frost is paid for once per panel: pads, keys and screens on it are flat translucent fills that never frost again, and the
  bench is a flat colour under one static light.
  Off is never faded; only a disabled key is. Legends are flat, single-ink pad printing with no shadow or glow. Text sits
  only on frosted or pad-printed areas. The character is on a Game Boy-style reflective LCD in a printed surround, and the
  backend rollup and commits are on small LCDs. The shell colour is its own Settings pick (Atomic purple by default, Clear,
  Smoke, Tangerine). Problems light the shell's rim red.

## Prompt for agents building a dev-tool UI

Paste this when asking an agent to build or restyle a tool in this repo:

> Build this as a **fun-first dev tool** following `DESIGN.md` in the workbench repo; maximalism is
> welcome. Make panels physical objects lying on a real, textured surface (edge thickness, contact
> shadows, sunk controls, pressed-in headings), and put ink where a hand would mark: halftone art,
> brush underlines, stamps. Animate the character in stepped frames (8–12fps,
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
