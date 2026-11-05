---
name: skill-harden
disable-model-invocation: true
description: >
  Audit and minimize an existing skill so the model does its best work: check the trigger,
  the structure, the leading words, and cut duplication and no-ops. Invoke-only — run it
  only when the user explicitly asks to harden, audit, minimize, or trim a skill, never on
  your own initiative. Invoke as `/skill-harden <skill-name-or-path>` in Claude Code or
  `$skill-harden <skill-name-or-path>` in Codex.
metadata:
  argument-hint: "<skill-name-or-path>"
---

# skill-harden

Make a skill smaller so a capable model does its best work. Over-prescribing hurts: a tight,
handcrafted skill often only matches an open-ended one, and the open-ended one finds blind
spots the rules baked in. Add detail only where a deletion test proves it changes behaviour.

Read the target `SKILL.md` and every file in its `references/` folder, then work the four
passes below. Report proposed changes grouped by pass with a one-line rationale each; apply
them only after the human agrees, or when they asked you to just do it.

## 1. Trigger

- **User-invocable vs model-invocable is a deliberate choice.** Model-invocable costs
  context on every prompt, adds noise, and is less predictable (the model may skip it).
  User-invocable costs no context and runs predictably, but the user must know it exists.
  Flip a skill to user-invocable (`disable-model-invocation: true`) when it is a deliberate
  action rather than something the model should reach for on its own.
- **The description is the trigger.** Give a model-invocable skill a description that says
  what it does and when to use it, in the industry's own words. Give a user-invocable skill
  a one-sentence hint plus the invocation form.

## 2. Structure

- **A skill is steps, references, or both.** Keep `SKILL.md` small, roughly 200 lines; check
  the repo's own budget if it enforces one.
- **Inline what every branch needs; extract what one branch needs.** A reference used on
  every path saves nothing as a separate file and may not load, so inline it. A reference
  used on one branch, or a large body of rules, belongs in `references/`.
- **A rule with no canonical home does not belong in the skill.** If content is a process or
  coordination rule the wider repo owns, move it to the doc every reader of that subtree
  already loads, and have the skill point at it. Route, do not restate.
- **Split a skill that does too much.** If the model does "just enough" on each of several
  jobs, two skills each get a thorough pass.

## 3. Leading words

- **Pack meaning into terms the model already knows.** "Create a vertical slice" beats a
  paragraph forbidding layer-by-layer work. "Report only", "separation of duties", "reuse
  ladder", "spec first" each carry a concept in two words.
- **Check the reasoning.** A working leading word gets repeated back in the model's thinking.
  If the skill still misses, strengthen or add leading words before adding prose.

## 4. Minimize

- **Deletion test.** Remove a passage, run the skill, and see if behaviour changes. Modern
  models write a decent commit message, name, or summary unprompted, so instructions telling
  them how are usually no-ops. Cut what does not change behaviour.
- **State each rule once.** A rule repeated across the skill and its references sends smaller
  reasoning models into loops. Fold it into the one section that owns it and point there.
- **Cut no-ops.** AI-authored skills insert text that looks procedural but does nothing.
- **Clear the sediment.** Content goes stale as people contribute and as models change.
  Re-audit periodically, and rebuild a skill from scratch when a new model generation lands.

## Preserve

Do not cut a passage that guards an observed model failure (a wrong default, a tool quirk, a
recurring mistake) or a non-obvious fact the model cannot derive. Those earn their lines. If
in doubt, keep it and note it as a candidate for a deletion test rather than removing it
blind.
