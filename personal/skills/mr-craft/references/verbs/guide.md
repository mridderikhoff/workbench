# Mode: guide

Guide mode updates mr-craft's own guidance under [`SKILL.md`](../../SKILL.md) → "Modes" and
"Hard rules". Edit the triggering component only on a separate request.

## Steps

1. **Generalize first.** Write a rule that stands without the component, ticket, or PR that
   raised it. Name the pattern, trigger, remedy, and allowed sibling. For example, a
   per-row click is fine, while a per-row listener for high-frequency pointer movement is a
   finding when a shared handler serves the same purpose. Use generic names. A concern that
   does not generalize is a one-off preference. Report that and stop.
2. **Pick the home** in the skill's standards and the [repo profile's rule sources](../repo-profile.md).
   - A mechanical pattern, such as a banned API or import shape, belongs in a deterministic
     check the repository runs. Name that check in the probe when it covers the pattern.
   - A judgment call belongs in a probe. Extend the closest probe first. Add an id only when
     no probe covers the question. Use the next number in its section, preserving existing ids.
     Start the bullet with ``- `<prefix>-<section>.<n>` **Title.**`` for the report skeleton.
   - A repository convention belongs in the rule source the repo profile names. Cite it as
     `path → "Heading"`. Hand off repository sources, checks, and repo craft guidance through
     [`SKILL.md`](../../SKILL.md) → "Relationship to repo skills".
3. **Read what is there.** Read the destination probe and its section. Search the other
   packets, [writer-digest.md](../writer-digest.md), and the relevant rule source for the topic.
   Mark it **covered** if a probe names it and the reviewer misses it (sharpen the trigger and
   its digest line), **uncovered** if no probe asks the question (extend or add),
   **contradicted** if a probe recommends the rejected pattern (correct it first), or
   **mechanical** if a check owns it (step 2). Give each topic one probe. Point to it from
   other packets where needed.
4. **Write it light.** Use one bullet with a bold title of two to four words. State what
   "is a finding", the remedy, and the allowed cases. State the class when the rule itself
   fixes one. Otherwise [`schema.md`](../schema.md) → "Classifying a row" decides.
   Aim for at most five lines per probe and one or two per digest entry. Write in the present
   tense about the current rule. Omit history, ticket rationale, and first- or second-person
   address. Cite the repository rule when one exists. Otherwise cite the packet heading.
   Name the category and give one or two examples. Leave an exhaustive list to the check that
   enforces it. Adapt supplied wording to these rules.
5. **Keep the surfaces in step.** Update the digest in the same commit when it names the
   probe or the concern recurs across the run directory's findings. Change the packet table in
   [`SKILL.md`](../../SKILL.md) only when a packet's scope changes. Include any required
   repository rule, enforcement reference, or check update in the hand-off.
6. **Verify and commit.** Run
   `node <skill-dir>/scripts/report-skeleton.mjs --root <repo root> --target <folder> --packet <packet-path> --out /dev/stdout`
   for each affected packet and confirm the expected ids. Validate any completed reports
   with `node <skill-dir>/scripts/report-check.mjs <report file>`. Run the skill's specs with
   `node --test <skill-dir>/scripts/*.spec.mjs`. Commit the guidance in the feature worktree,
   separately from any component fix. Shipping follows the hard rules.

## Output

Report the rule with its id and home, the allowed sibling pattern, corrections or merges,
affected surfaces, and verification, in that order. Name the deterministic check when the
rule belongs in a check.
