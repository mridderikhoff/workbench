# Overseer scene notebook

**Desk** places every panel on a textured desk. **Radio** places the character portrait beside a message plate that reports one current status fact. It reuses Desk's backend and session cards and their controls. Book and Console were built, tried and retired; their notes are below so either can come back. Everything in the deferred list is an idea for later, not a promise to build it.

The [design guide](../DESIGN.md) is authoritative: expressive animation is the heart of the app. A scene supplies a
composition; a theme supplies its visual world. Settings > Overseer selects the character independently, with Blip as the
default. The eye may become an avatar, creature, machine, or another
expressive subject in a future theme. Preserve the deliberate marks, animation, responsiveness, and personality, rather
than requiring an eye.

## Retired: Book

**What it was.** An open ledger filling the window: a pixel-art spread of two aged pages with a gutter shadow, stacked page
edges, deckled borders, foxing, faint ruled lines and one dog-eared corner, painted once on the 4.5px lattice. Backend
status and the eye sat on the left page, the sessions on the right as ruled entries with no card chrome. Below 1100px it
became a single page. A sticky header carried the wordmark and engraved acanthus finials.

**What worked.** Content printed on the paper rather than pasted over it. Healthy entries were quiet, so a failure stood out.
The dog-ear and foxing gave it a hand-made feel at almost no cost.

**What didn't.** The spread was as wide as the window, so on a large screen the two columns sat far apart (160px gutter)
and the eye travelled too far between Backend and sessions. It needed a smaller spread with the content centred. Pixel
pages next to the smooth halftone eye mixed two mark languages.

**How it could come back.** As a layout on the Desk engine, not a separate painter: a bound book lying on the desk, painted
as a `paper` stock tile, about 1100px wide and centred, with the eye card on the left page and sessions on the right. Keep
the desk surface, props and tiles; add a gutter shadow and page edges in CSS or one more cached tile. Give it its own
`data-scene` value and scope its layout rules to it, so Desk stays untouched.

## Retired: Console

**What it was.** A game-style control panel: a pixel control-room backdrop (window, ribbed bulkheads, a low deck), a
portrait window for the eye labelled "Overseer", the Backend panel under it and the sessions in a main display. Every
panel, pill, field and button was a 9-slice pixel plate with four-pixel stair corners, generated per theme from a small
colour set.

**What worked.** The eye had a clear, framed home beside real backend data (the DOOM-face idea) without fake meters. One
frame sprite made every surface consistent.

**What didn't.** The pixel plates were overboard: every control in the same heavy frame made the page busy, flattened the
hierarchy and fought the halftone eye. The backdrop added noise behind the work.

**How it could come back.** On the Desk engine as a theme-driven variant rather than a frame on everything: one display
bezel around the eye card (a deskArt mount or a cached tile), the sessions on an acrylic panel, and plain sunk controls.
Use the plate look, if at all, for the portrait only. Neon's LED readout and keycap pills already carry most of the
console feel.

## Deferred scene ideas

| Scene | Composition and character role | Possible interpretations across themes |
| --- | --- | --- |
| Atlas | Sessions are clearly labelled locations, with the character acting as a guide. | Paper chart; city map; desktop overview; star map. Avoid implying network relationships that the data does not establish. |
| Gallery | Sessions occupy framed exhibits or display bays; the character is a guide between them. | Portrait gallery; surveillance wall; tiled desktop windows; ship display modules. |
| Watchtower | A clear central health signal with sessions arranged as readable watch stations. | Gothic lookout; city control room; system monitor; orbital station. |
| Printing room | Sessions are proofs or reports, with failures marked in red ink; the character attends the process. | Letterpress shop; hacker print queue; classic Mac print studio; fabrication control room. |

Candlelight and fog already live in Desk as materials and atmosphere. They do not need to become
scene choices of their own.

Neon covers cyberpunk. Possible future themes include classic Mac and general science fiction. Do not build
them yet. The same scene compositions should adapt to those worlds without losing the animated
character or making the interface harder to use.

## Inspiration, not assets to copy

- [Lucas Pope's notes on the Obra Dinn book](https://dukope.com/devlogs/obra-dinn/tig-37/): a coherent
  organizing object, consistent page measurements, and content integrated into the book.
- [Holmik's Blasphemous menu art](https://pixeljoint.com/pixelart/130413.htm): detailed focal art
  with quiet surrounding space.
- [Star Fox 64 HUD screenshot](https://www.nintendoworldreport.com/media/42342/1/2.jpg): character
  communication integrated into the working view.
- [DOOM HUD screenshot](https://images.cgames.de/images/gamestar/287/doom-14_6002974.jpg): an animated
  face embedded among real status information.

All implemented artwork should be original. Borrow compositional lessons, not characters,
textures, logos, or the exact game interface.
