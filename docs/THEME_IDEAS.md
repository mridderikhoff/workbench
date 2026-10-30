# Theme ideas

A theme supplies materials and reusable character effects. Blip is the global default; the user can pick any character in any theme (Settings > Overseer, a `CHARACTERS` entry in `bin/qa-dashboard`). Every character needs (a) a clear face or
head that can follow the cursor and (b) something to animate while idle, the way Blip glances or the Eye blinks. The character's expression also carries the backend status, with a different shape per
state (see DESIGN.md rule 5).

## Built

- **Terminal** (now the default theme): putty plastic and keycaps around a Fallout-style CRT. The
  whole eye card is the screen: a curved glass in a putty bezel with baked scanlines, glow and
  vignette, a slow rolling refresh band and an occasional flicker (transform and opacity only; still
  in Static and reduced motion). Blip is a large ASCII face whose pupils follow the
  cursor on the CRT. The glass keeps its flashes and static warble. There is no typed prompt line and no props.
  Keys press down and their legend lights LED green. See DESIGN.md rule 9.
- **Clear Plastic** (replaced Neon): late-90s and Y2K see-through electronics. Every panel is a clear
  shell over a real circuit board (pre-rendered SVG tiles: copper traces under green or black solder
  mask, ICs with pad-printed part numbers, SMD passives, crystals, screws in clear bosses, flex cables),
  with the board's shadow on the back shell and thick walls with a refraction line. The insides mirror
  real state: a running app is a chip beside its key, with a faint pulse along its trace while it starts;
  a stopped app is an empty socket and an unserved one a bare footprint; status LEDs glow up through the
  plastic. Keys are clear caps with the switch visible through a window, and hover lights the LED under
  the cap. The character is on a Game Boy-style reflective LCD in a printed surround. Text sits only on
  frosted or pad-printed areas. Shell colours are a Settings pick: Clear, Smoke, Atomic purple, Tangerine.
- **Characters** (independent of theme): Eye (the halftone eye) and Blip (global default).

## Owl (follow-up, still an idea)

A cosy, non-horror theme: the owl keeps the "overseer" idea without the creepiness.

- **Follows you:** owls turn the whole head, so tracking the cursor is the most natural motion of
  any character we considered. Turn the head in whole-cell steps, with a slight overshoot on big
  jumps, and let the eyes lead.
- **Idle:** slow, irregular blinks (sometimes one eye first), ear tufts twitching, a feather ruffle
  that travels down the chest, and an occasional slow head tilt. All of it non-periodic.
- **Status faces:** healthy = calm, half-lidded; starting = one eye open, head cocked; broken = wide
  eyes, feathers ruffled out; down = asleep, head tucked; needs a human = staring straight at you.
- **Materials:** a night study or a branch at dusk. Ideas: a wooden perch rail across the top of the
  eye card, moonlit paper, ink-wash feathers, pressed leaves or a quill as desk props screened into
  halftone dots. Palette: midnight blue, moss, warm lamp amber; problems in a clear red-orange.
- **Halftone fit:** feathers and big round eyes read well as dots; keep the eye discs large so the
  pupils stay crisp at the 4.5px pitch.

## Considered and parked

- **Kit-Cat clock cat:** eyes follow you and the tail swings. Charming, but a regular swing is the
  rhythmic motion DESIGN.md bans; it would need an irregular, lazy swing.
- **Little robot (binocular head):** friendly but the most generic and clip-art-like.
