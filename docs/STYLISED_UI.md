# Stylised UI playbook

How Overseer gets its game-UI energy without breaking `DESIGN.md`. Read this before any visual
iteration. `DESIGN.md` holds the rules; this file holds the craft: what we borrow from hyper-stylised
game UIs and how we adapt it. Sources and notes from the original research: Persona 5 and Metaphor
(Atlus interviews), Hades, Balatro, Inscryption, Disco Elysium, Pentiment, NieR: Automata, Return of
the Obra Dinn, Cult of the Lamb, Death Stranding, Cyberpunk 2077, Fallout, Bruno Simon's portfolio.

## The calls we've made

1. **A theme is one set of materials; the character is its own setting.** The character (Eye,
   Blip the CRT face, later an owl) is the masthead. Blip is the global default and the
   Settings > Overseer pick wins, so every character must render in every theme, in that theme's inks; the panels are physical objects (card stock on leather, acrylic on a cutting mat,
   a CRT and putty plastic). Every pixel of the theme answers "what is this made of?"
2. **Materials over gradients.** Inscryption's candlelit table, NieR's warm paper UI. Surfaces get
   real texture, light falloff and contact shadows; nothing is a flat colour or a generic gradient.
3. **Marks match the material.** On leather: gold-foil hot-stamping for titles, blind tooling for
   secondary text, saddle stitching for seams. On paper: rubber stamps and brush ink. On acrylic:
   stencils and printed labels. On a CRT: phosphor glyphs. Never a plain dashed CSS line.
4. **The character's art language is the house style.** The eye is a halftone, so props are screened
   into the same dots. Props that don't share the language get cut (the floppy disk and the mug went).
5. **Style first, then tune legibility.** Persona 5's menus were unreadable at first and were tuned
   until they weren't. Status text stays upright, plain and AA; decoration can tilt, bleed and drip.
6. **A forced palette, with one meaning per colour.** Horror: blood red on bone and black. Neon:
   magenta and cyan, red for problems. Terminal: phosphor green and amber, red for problems. A
   colour never means two things.
7. **Each theme has a signature hover.** Horror: the blood seep (an uneven wet band in the bottom
   third, one drop with a cooldown). Neon: the stepped pixel charge bar. Terminal keycaps: the key
   presses down and its legend lights up as if backlit. Apply the signature everywhere it makes
   sense (buttons, options, toggles), but match the object: a keycap is pressed, not filled.
   Hover plays once, on arrival: a click or a poll that rebuilds the hovered element must not replay
   it (the rebuilt element starts settled).
8. **Impact scales with importance** (Vlambeer, Balatro). A pill turning ready gets a small squash
   and overshoot; a failure gets one jitter and its loud colour; a backend going down gets the
   biggest moment. Healthy is quiet.
9. **Sequence, don't dump** (Balatro). Cards deal in about 50ms apart on load; several changes at
   once resolve one after another, left to right.
10. **Confirm thumps, cancel rubber-bands.** A short visual hit-stop (about 80ms) then a press or
    stamp on confirm; a soft spring back on cancel. Never delay the actual request.
11. **The character reacts.** It follows the cursor, glances at whatever just changed, and its
    expression is the backend status. It always lets go (leave, blur, hidden tab, idle).
12. **Idle life is irregular and rare.** Every 20 to 40 seconds something small happens: a candle
    flickers, Blip winks, the phosphor glitches for a frame. No loops on a fixed beat.
13. **Fake the expensive effect** (Bruno Simon's baked lighting). Glow, scanlines, curvature, grain
    and foil are pre-rendered tiles or static layers. Only opacity and transform animate.
14. **Effects have an off switch.** Reduced motion gives a designed still frame; Static logo mode
    runs no loop.

## Toolbox (pick per theme, per moment)

| Moment | Technique | Notes |
|---|---|---|
| Page load | Cards stagger in; CRT turn-on line (Terminal); slab sweeps in behind the title (Neon) | Under 400ms total |
| Hover | The theme's signature hover; a foil sheen on stamped titles | Readable mid-animation |
| Confirm / cancel | Hit-stop then thump or stamp; spring back on cancel | Visual only |
| Dialog opens | It arrives like an object: dealt like a card, slid out, or the CRT warms up | Same materials as the cards |
| Status change | Squash and overshoot on ready; one jitter on failure; the character glances at it | Animate only what changed |
| Message arrives | Radio gives one short hail, static burst, and text reveal | Under 900ms; none on load |
| Error | Theme-specific mark: a blood splat sprite, a hazard-tape wipe, an inverse-video block | Loud but brief, then still |
| Idle | One rare, irregular ambient event | Paused when hidden or behind a modal |

## Don'ts (and the adaptation)

- **Whole-page shake:** causes nausea. Shake one pill or card, once; never under reduced motion.
- **Live glitch, chromatic aberration or CRT shaders:** bake them into static or pre-rendered
  frames; never put them on status text.
- **Tilted, cluttered status type (Persona):** tilt the decorative slab, not the label.
- **Looping shimmer everywhere:** one focal element at most, and on hover.
- **Kinetic type on every update:** only the item that changed, under 300ms.
- **Narrator or jokey copy:** the words stay plain; personality lives in the visuals.
- **Tiny type (Death Stranding):** 13px minimum for metadata, 14px for anything you act on.
- **Clip-art props:** if it isn't drawn in the character's art language, cut it.

## Character and material extension

A character can own the wordmark underline with `stage.wordmarkFloor`. The shared layout measures
the wordmark on layout changes and leaves room beneath it for the animated floor, replacing the
theme's brushstroke. Keep the art's size and centre independent of that extra canvas space.

A character renderer owns its face geometry, status expressions, and motion schedule. It draws into
the shared halftone grid. A theme selects reusable effects in `characterEffects`, keyed by character
id. `CHARACTER_EFFECTS` holds small `init(engine, state)` and `frame(engine, state, time)` modules.
`composeCharacterEffects(id, engine, state)` resolves them once and returns a cached `frame(time)`.
State supplies grid dimensions, face bounds, foreground value and ink masks, seed, activity, status,
and the current face ink. Fill `fgVal` and `fgInk` before the effect frame. An effect can dim `fgVal`,
write directly with `engine.put`, and set `engine.back` to a full-dot bucket (`ink * 5 + shade`,
where shade is 1–5). Its ink numbers must match the engine's named ramps. Commit the foreground
masks to the grid after the effect frame, then present the canvas. A character that draws straight
to `engine.intensity` needs matching masks and this same commit order to use `shine`.
Seed schedules and glyphs during `init`; `frame` must avoid allocations.

For a future Owl renderer, call `composeCharacterEffects("owl", engine, state)` in its mode's `init`.
On each frame, update `state.status` and `state.ink`, fill the face masks, call the returned
`frame(time)`, commit those masks to the engine grid, and present the canvas. `engine.aim` returns a
reused mutable cursor sample; consume it immediately rather than keeping a reference.
A theme can select `characterEffects: {owl: ["shine"]}` using the same theme key and effect registry.
The Owl adds one `CHARACTERS` entry with Full, Subtle, and Static modes; the picker lists it automatically.
The current picker labels are exactly **Blip** and **Eye**, with Blip as the global initial and fallback.
