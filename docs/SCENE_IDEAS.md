# Overseer scene notebook

Only **Book** and **Console** are in the current implementation scope. Everything in the deferred
list is an idea for later, not a selectable scene or a promise to build it now.

The [design guide](../DESIGN.md) is authoritative: expressive pixel animation is the heart of the
app. A scene supplies a composition; a theme supplies its visual world and character. The eye may
become an avatar, creature, machine, or another expressive subject in a future theme. Preserve the
deliberate pixels, animation, responsiveness, and personality, rather than requiring an eye.

## The two current scenes

### Book

An open working ledger. Backend status and the animated character occupy the left page; sessions
read as entries on the right. Content belongs to the paper, with clear margins and quiet ink rules.
On narrow screens it becomes a single page. Keep the character immediately below Backend.

Continue refining this scene rather than adding more floating panels over the book. Materials could
later become an occult ledger, a technical field journal, or a digital notebook under other themes.

### Console

An original video-game-inspired developer control panel. Start with a prominent animated-character
display beside actual backend information, with sessions in the main work display. Use the portrait
placement and integrated instrument-panel composition of Star Fox and DOOM as loose references.
The earlier Game Boy Advance menu reference also informs the portrait-and-data arrangement.

Keep it a developer workspace: no copied game artwork, fake ammo or health counters, pretend A/B
buttons, crosshairs over text, or game navigation that makes ordinary actions harder. The interface
should feel built into the scene, while the character remains expressive and easy to see.

Console replaces the earlier working names Stage and Plain. Those were names for the basic view,
not additional scenes to retain in the picker.

## Deferred scene ideas

| Scene | Composition and character role | Possible interpretations across themes |
| --- | --- | --- |
| Workspace | Sessions laid out beside a companion at a working surface. | Candlelit writing desk; cyberpunk workstation; classic Mac desktop; spacecraft workbench. |
| Atlas | Sessions are clearly labelled locations, with the character acting as a guide. | Paper chart; city map; desktop overview; star map. Avoid implying network relationships that the data does not establish. |
| Gallery | Sessions occupy framed exhibits or display bays; the character is a guide between them. | Portrait gallery; surveillance wall; tiled desktop windows; ship display modules. |
| Watchtower | A clear central health signal with sessions arranged as readable watch stations. | Gothic lookout; city control room; system monitor; orbital station. |
| Printing room | Sessions are proofs or reports, with failures marked in red ink; the character attends the process. | Letterpress shop; hacker print queue; classic Mac print studio; fabrication control room. |

Candlelight and fog can return as materials or atmosphere within a future scene. They do not need
to become additional scene choices merely because their artwork exists.

Possible future themes include cyberpunk, classic Mac, and general science fiction. Do not build
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
