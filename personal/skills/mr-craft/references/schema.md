# Review schema

The one shape every packet and mode reports in: the findings table, the five classes, the test
that assigns them, and the report-file layout. Reviewers read it in full before any code.
Packets add probes, never classification rules of their own.

## Review scope

A review covers the target and the files it consumes.

- **Consumed files.** The target folder plus every first-party file it imports or references,
  followed transitively: `_internal/*`, shared services, stores, helpers, types, templates, and
  stylesheets named in `templateUrl`, `styleUrl(s)`, or a Sass `@use`, `@forward`, or
  `@import`. Spec files are excluded unless a packet's test probes need them.
- **Published components.** When the closure reaches a component in the repo's
  component library, judge how the target uses its documented API. Published component
  contracts themselves are outside this packet. Follow shared implementation that the
  target owns or consumes, including `_internal/` helpers. For a workspace package import,
  an entry at `src/public-api.ts` or `src/public_api.ts` is a published contract boundary:
  list it as `contract only` and do not traverse its exports. An entry at `src/index.ts`
  is an ordinary source barrel: follow it and its imports, unless the separate sibling
  component boundary also makes it `contract only`.
- **Third-party libraries.** Judge whether the target configures and calls the API correctly
  (CDK Overlay strategies, disposal, `FocusMonitor`, D3); never review the library itself.
  Consult its documentation, or its source under `node_modules`, only to confirm the
  contract a finding relies on, and cite it.
- **One attribution per file.** A finding in a consumed file cites that file's `file:line`,
  states the failure from the target's usage, and names the file's other in-repo consumers when
  relevant (`git grep` its import path).
- **Consumers of the target** stay out of scope, except the architecture packet's bounded
  consumer reading. A defect found there is one line under `## Outside this review's scope`,
  never a row.

After its metadata header, the report lists one line per first-party file in scope under
`## Files reviewed`:

```
- `<repo-relative path>` — <reason>
```

`<reason>` is `target`, `consumed via <importer>`, `contract only`, or `lazy boundary`. A file
reached through a path alias names the alias, as in `consumed via <importer> (@workspace/forms)`.
Third-party packages are not listed.

### Diff-scoped targets

An explicitly named branch or PR limits findings and edits to its recorded diff and the
contracts directly affected by those changes. Read the full consumed-file scope above for
context; reading a file does not authorize unrelated cleanup in it. Rename detection preserves
the distinction between moved code and changed behavior. A pre-existing issue unrelated to the
diff goes under `## Outside this review's scope`, never into an apply row. New files and direct
dependencies changed by an authorized review fix join the scope on re-review. An explicitly
named path without a branch or PR keeps whole-target scope.

## Rule citation fallback

Each packet cites rule sources by role and topic in the repo profile. Read the relevant
section of that role's actual source and cite its path and section. When the role is
`none`, or the source has no section for that topic, the packet's own probe text is the
rule. Cite that packet section in the finding.

## Findings table

| Probe | Finding (`file:line`) | Class | Action |
| --- | --- | --- | --- |
| `craft-1.1` | `text-input.component.ts:42` `pushedSize` names the mechanism (`angular` packet → §1 Names) | fix | Rename to `formFieldSize`; update its two reads |
| `craft-2.7` | no findings — 4 template bindings, all read by the template | | none |

- **Probe** is the packet bullet's id in backticks, exactly as the packet writes it; the
  coverage checker reads that form from the Probe cell.
- **Finding** states the defect at its `file:line`, then cites the profile role, topic,
  and actual source section (`path → "Heading"`), or
  takes one of the four empty forms under "One row per probe". Architecture and wildcard
  findings may cite concrete evidence and label an evidence-based judgment instead of a rule.
- **Class** is one of the five below.
- **Action** is the one-line change a writer makes, or `none`. A rename names the new name; a
  **mandated** or **default** row names its regression test; a **default** row records its
  assumption; a **decide** row carries the question.

## Classes

| Class | Meaning | Applied by |
| --- | --- | --- |
| **fix** | Neutral: no change to behaviour, rendering, or public API, shown statically. | refine |
| **mandated** | Changes behaviour; one cited source (type, spec, doc comment, canonical rule) admits exactly one compliant result. Preserve public compatibility unless the PR declares and authorizes the break. Limit rendering changes to what the source prescribes. | refine |
| **default** | Changes behaviour, rendering, or a repository-only contract; no source prescribes one result, but the facts make one option clearly best. Applied with the assumption recorded: `Default: <choice> — <evidence>; override: <act>`. Record design-facing assumptions with the evidence and the override in the report. | refine |
| **verify** | Cannot be judged without runtime evidence (a render, a computed style, a keyboard or assistive-technology pass, a measurement). The Action names the observation and what each outcome turns the row into. | refine routes it |
| **decide** | Needs the owner's intent, only after the escalation test below. The Action states the question, the options, what each changes, and the agent's lean or `No lean`. | never by an agent |

Where classes combine in one row or merged row, the most human-facing wins, in the order
decide > verify > default > mandated > fix.

Policy recorded for the human but not a row: a **debt note** (a rule the current code breaks
where the required change is not allowed in this review, such as an undeclared breaking change) and a
**readiness item** (a required approval, review, sign-off, or manual pass). Both live in their
own lists under the table; neither counts as a finding or a decision.

## Classifying a row

Work the steps in order and stop at the first that applies. The gate is necessity first,
evidence second, intent last.

1. **Is a change necessary?** Name the concrete defect and the cited rule or contract it
   breaks. If the best action is to preserve the current code, there is no finding: at most a
   debt note. "Pre-existing", "sanction the current value", "confirm the current API", and
   "approve the existing default" are not findings.
2. **Does one source prescribe the result?** A type, spec, doc comment, or canonical rule that
   admits one compliant result makes the row **mandated** (behaviour) or **fix** (neutral),
   unless the result renames, removes, or narrows a public surface. That follows "Defaults
   for recurring cases" below. A record that conflicts with the current agreed specification
   and implementation is stale. Correcting that record is **fix**.
3. **Establish the facts the review can establish.** Use `git grep` to count known uses of the
   member, selector, or class. Inspect the package's public exports and documented contract.
   External consumers may install published packages. Zero in-repo matches do
   not make a published surface internal. Read the recorded defaults and sibling components
   that solved the same problem. A fact the agent can look up is never a question for the human.
4. **Do the facts make one option clearly best?** Then it is **default**: the agent chooses,
   applies, and records the assumption. Clear means the existing implementation, usages, spec,
   siblings, or recorded defaults would lead a careful maintainer to the same choice. A firm
   lean alone is not clear: when two options still differ for users, for accessibility, or
   for a published contract, continue to steps 5 and 6. A default that changes behaviour carries
   the regression test and the record its class requires.
5. **Would running the code settle it?** Then **verify**.
6. **Otherwise decide.** Every condition must hold: (i) a change is necessary; (ii) after steps
   2–5 at least two options remain whose product behaviour, design-visible result, accessibility
   semantics, or published contract materially differ; (iii) the owner's intent is not
   inferable from the code, usages, spec, or siblings, or canonical sources conflict about that
   intent; (iv) a wrong guess would affect users, break a published public surface, or need
   a migration to undo. The row names which sources were read and why they do not settle it.

### Defaults for recurring cases

| Case | Resolution |
| --- | --- |
| Rename, removal, or narrowing of a published member, selector, input, output, host class, or tracking shape | Preserve the published contract and record debt unless the change is authorized. An authorized break includes migration guidance according to repository policy. A change the contract uniquely defines is **mandated**. Use the escalation test for open choices. |
| Deprecated public surface | Preserve the public contract until a declared major break. A missing `@deprecated` pointer to its valid replacement is **fix**. |
| Repository-only member, selector, or class that forms an in-repo contract | Find and account for its callers. Apply a supported correction with a coordinated migration when the evidence settles it. Use **decide** when material compatibility choices remain after the escalation test. |
| Documented public member with no concrete defect, any consumer count | No finding |
| Internal surface, such as an unpublished `_internal/` helper, an unexported member, or a template-only member | **fix** for a neutral change. For an inner BEM element, wrapper, or custom property, check for documented styling hooks and in-repo use before treating it as internal. |
| Projection slot without a justification that holds under `architecture-1.6` | A defect. Classify by the appropriate public contract row above. |
| Input shape that a policy would design differently, with no defect | Debt note; redesign is a separate task |
| Spec `Source:`/`Ref:`, Figma export, or design file missing or unreachable | Readiness item, one per component; keep the existing references |
| Estimated or eyeballed value (spacing, alpha, duration, width) with no token or source | Keep it; readiness item for design confirmation; a token for it is **default** when a sibling already tokenizes the same role |
| Input outside its typed contract (`NaN`, negative, overflow, unknown enum) | Existing default, clamp endpoint, or neutral fallback, with a test: **mandated** when a source names it, else **default** |
| Error, empty, or loading copy with no copy source | Reuse the nearest sibling's wording: **default**; **decide** when no sibling supplies wording |
| Conflict-resolution, pagination, virtualization, or loading treatment with no spec | The treatment a sibling repository component or an existing content-state contract already uses: **default**; **verify** when only a measurement separates options |
| Required approval, independent review, PR record, designer sign-off, or real screen-reader pass | Readiness item |
| Canonical sources conflict about what the product does or shows (a policy says one thing, a mockup or spec another) | **decide**, citing both |
| Interaction model or accessibility semantics with no spec and no sibling precedent (is this element a button, what does `interactive` promise, which heading level) | **decide** |

## Wildcard rule

Each packet's other-material-concern probe reports a defect the named probes miss. It needs
independent judgment within the packet's category, concrete local evidence, and a stated
impact. A stylistic preference alone is not a defect. Uncertainty that only runtime evidence
can settle is **verify**. It is never a canonical mandate, never fills a row for its own sake,
and never reaches into another packet's scope.

## One row per probe

Every probe id in every packet that ran produces exactly one row. A probe without a finding
takes one of four forms, each with empty Class and Action `none`:

- `no findings — <evidence>`: what was inspected and how many (`6 slots, each caller projects
  composed repository components`).
- `not applicable — <why>`: the target cannot exercise the probe, or the rule is reported under
  another probe id.
- `readiness pending — <required act>`: an applicable prerequisite lacks evidence; carry it in
  the readiness list. Use it only when the probe has no other finding.
- `debt noted — <rule>`: the probe's only outcome is a debt note; carry it in the debt list.
  Use it only when the probe has no other finding.

## Architecture rows

An architecture probe may hold several concerns in its one row as labelled `<br>`-separated
entries in `Finding` and `Action`. Each concern names its claim or source, `file:line`
evidence, impact, alternative, recommendation, adoption timing, its own `Class:`, and
`Compatibility: breaking (<n> in-repo consumers: <paths>; external consumers affected)`
for a published surface, `Compatibility: breaking (<n> in-repo consumers: <paths>)` for
a repository-only surface, or `Compatibility: non-breaking`. Check repository uses with
`git grep` and the package's published contract. The row's Class column holds the most human-facing class among its concerns. A stated purpose is evidence under test, not a
canonical rule: say whether a concern violates a cited contract or tests a claim. A
non-breaking internal refactor that preserves behaviour and rendering is **fix** even when
several techniques can implement it.

## Report layout

Each reviewer fills one report from the skeleton. Keep the first line
`<!-- mr-craft-report: {"packet":"<packet>"} -->`. An angular section report also
has a `section` key as supplied by the skeleton. The metadata identifies the packet and
any section for `report-check.mjs`.

Keep the sections in this order:

1. `## Files reviewed`, with the file list described above.
2. For architecture, `## Architecture as found` and `## Abstractions reviewed`.
3. `## Findings`, with the four-column table shown above. Put rows with a class here.
4. `## Coverage: <answered> of <total> probes examined`, with the same table header. Put
   rows that use one of the four empty forms here. Count probe ids across the two tables and answer each
   probe exactly once. Complete coverage reads `## Coverage: N of N probes examined`.
5. `## Debt` and `## Readiness`, with the affected probe ids and targets.
6. `## Outside this review's scope`, with concise notes for unrelated concerns.

Keep every heading. Use `None` for an empty notes section and no data rows for an empty
table. Remove all `TODO` placeholders and `<!-- unresolved: … -->` entries. Paths are
relative to the tree the writers edit. Every re-review reads that same tree.
