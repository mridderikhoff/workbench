---
name: mr-craft
disable-model-invocation: true
description: >
  Builds, refines, and reports on Angular/TypeScript code in any repository against Angular
  craft, performance, correctness, and architecture packets. A task means build, a path or PR
  means refine, and --report is read-only. A prose request to update mr-craft guidance or
  apply proposed guidance updates means guide.
metadata:
  argument-hint: "<task | path | PR | guidance request> [--report [packets]]"
---

# mr-craft

Invoke `/mr-craft …` in Claude Code or `$mr-craft …` in Codex. A writer builds or applies findings.
An independent reviewer follows [reviewer.md](references/reviewer.md) for one packet and
one target. The orchestrator routes work and merges reports. [schema.md](references/schema.md)
defines scope, findings, classes, and report layout.

`<skill-dir>` means the directory containing this SKILL.md: use the path from which the host
loaded the skill. Before any code reviewer or writer starts, resolve and write
`<run directory>/repo-profile.md` under [repo-profile.md](references/repo-profile.md).
Pass its absolute path in every briefing. Use it for supported targets, gates, test stack,
rule sources, and any repo craft skill.

## Hard rules

- Full suites run only when asked. Writers add and update tests. In build, run the repo
  profile's scoped typecheck after each writer batch, then scoped tests and lint for changed
  paths before the manual QA checkpoint. In refine, run scoped tests and lint for changed
  paths after each writer batch. After a failure, rerun only failing specs. When
  no scoped command exists, record that and ask before running anything broader. Reviewers
  and report mode run no code gates. Report validation follows
  [report.md](references/verbs/report.md) step 4.
- Reuse a supplied clean feature worktree. Otherwise provision one under the user's global
  instructions before any writer starts. Never edit a shared checkout or QA runtime tree.
  Shipping, PRs, servers, and QA attachment each need a separate request.
- One packet per reviewer briefing. Batch equivalent checklists only when host instructions
  permit it, with a separate report and evidence for each packet.
- The orchestrator never reads packets or judges code. It checks reviewer coverage and
  reconciles findings. Never infer a target from open files or the branch; ask if none is given.
- Never present inline review as independent or label it an mr-craft review or report. If no
  independent reviewer is available, state the limit before offering an explicitly inline pass.
- Change this skill's packets or schema only when asked (a guide-mode request is that ask).
  Put guidance proposals in the hand-off.

## Modes

| Invocation | Use | Reference |
| --- | --- | --- |
| `/mr-craft <task>` | Build the task, then triage, no review for a prototype, or refine | [build.md](references/verbs/build.md) |
| `/mr-craft <path or PR>` | Refine: review, verify, and apply fix, mandated, and default findings | [refine.md](references/verbs/refine.md) |
| `/mr-craft <path or PR> --report [packets]` | Read-only findings; architecture alone reviews the whole target | [report.md](references/verbs/report.md) |
| `/mr-craft <guidance request>` | Guide: update mr-craft guidance and route repository rules to their owners | [guide.md](references/verbs/guide.md) |

Route requests in order. Any mention of mr-craft with a target calls for independent packet
reviewers; an inline pass is not an mr-craft run. Explicit build, refine, `--report`, and
guidance-change modes follow the table; guide mode needs no flag. With no mode named, a
question or analysis about a target uses report mode. Follow [report.md](references/verbs/report.md)
step 2 for default packets; simplification or subtraction uses `angular correctness performance`.
With no mode named, an action on a target uses refine. "Run mr-craft on X", "do a mr-craft pass on
Y", and "mr-craft this branch" are action examples; "skip architecture" and "checklists only"
are examples of exclusions under [refine.md](references/verbs/refine.md).

A bare existing supported path, PR, or named branch means refine; a branch uses its changed
supported files. Other concrete tasks mean build. A bare path keeps whole-target scope. Ask
when ambiguous. Packet names after `--report` are space-separated.

**PR targets.** Resolve with `gh pr view <PR> --json
headRepository,headRepositoryOwner,headRefName,headRefOid,baseRefName,baseRefOid,files`.
Review exactly `headRefOid` and confirm the review tree's HEAD matches before spawning.
Refine requires a clean worktree on the PR branch at that commit. For a fork or competing
dirty checkout, ask. Report mode may use a detached worktree. Map changed `.ts`, `.html`,
`.css`, and `.scss` files in supported projects to their nearest component or feature folder.
Each folder has its own packet plan; architecture is unsharded per folder. A PR run shares
one directory named `pr-<number>` and prefixes reports with `<folder-slug>--`.
If the PR has no changed Angular/TypeScript source files in supported projects, report that
and stop. A mixed report keeps every selected packet's findings; architecture stays separate.

## Packets

| Packet | Judges | Applies to | Read before writing | Reference |
| --- | --- | --- | --- | --- |
| `angular` | Names, subtraction, Angular/TypeScript, CSS, comments, tests | Supported Angular/TS targets | §1–3 on any change; §6 when tests or runtime ownership change | [angular.md](references/packets/angular.md) |
| `performance` | Data work, reactivity, lifecycle, rendering, loading, network | Supported Angular/TS targets | §1–3 on any change | [performance.md](references/packets/performance.md) |
| `correctness` | Inputs, failures, state, values, API use | Supported Angular/TS targets | §1–3 on any change | [correctness.md](references/packets/correctness.md) |
| `architecture` | Abstractions, boundaries, contracts, change path | Targets with relevant design choices | Whole packet when ownership, public type, abstraction, capability, styling API, or responsive contract changes | [architecture.md](references/packets/architecture.md) |

A build writer reads the routed sections before writing, checks changed files against them
before returning, and reads [writer-digest.md](references/writer-digest.md). This self-check
is not an independent review. Refine writers apply only handed rows and end with one
`applied` or `returned` line per concern key.

## Spawning the reviewer

- One host general-purpose/default subagent runs the [packet reviewer task](references/reviewer.md)
  per packet briefing. [Report step 3](references/verbs/report.md#steps) sets scope, launch, and completion.
- Use another model family for checklist packets when available; use the strongest reviewer
  for architecture. Respect host concurrency.
- When delegating a whole pass, forward its literal invocation (`/mr-craft <target>` in Claude
  Code, `$mr-craft <target>` in Codex) because automatic invocation is disabled.
- Before each spawn, run `node <skill-dir>/scripts/report-skeleton.mjs --root <repo root>
  --target <folder> --packet <packet-path> [--section <n>] [--changed <run directory>/changed.txt]
  --out <report file>`. Pass `--changed` under diff scope.
- Brief with absolute worktree root, target, one packet path, schema path, repo profile path,
  report path, recorded scope, and `report only`. Forward existing evidence and, for
  architecture, supplied rationale and design goals.
- Check completed reports with `node <skill-dir>/scripts/report-check.mjs <report-file> [<report-file> …]`.
  The report file, not the reviewer's reply, is the coverage record.

## Relationship to repo skills

A repo's own craft skill remains its team's standard. Hand off repository-owned guidance and
checks to the craft skill named in the repo profile, or to the repository's owning workflow
when the profile lists no craft skill. Published component contracts belong to the repository
skill. When it has a `*-contract` packet, hand off
`/<repo-skill> <target> --report <contract-packet>` for that review.

## Commands

Feedback after a review first becomes a concrete correction with compatibility impact.
Apply authorized changes with relevant tests and consumer updates. Under **Proposed guidance
updates**, state whether an existing probe should change. Name each proposal's home per
[guide.md](references/verbs/guide.md) step 2. Apply an accepted proposal in guide mode.
A request to propose and implement authorizes the scoped change, including named public API
corrections. Report compatibility and migration effects before applying them.
