---
name: orchestrate
description: Coordinate a medium or large, multi-phase effort with a durable plan and bounded agent assignments. Use when the work has consequential design choices, dependencies, or enough implementation and review to outgrow one context; skip for small, direct fixes.
---

# Orchestrate

**The main thread owns the result.** Use fresh, narrowly briefed agents
for investigation, implementation, and verification when delegation is available.
Write decisions and progress to durable files so the effort can resume after a
context reset. The user goal, current code, and observed behavior remain the
authority; existing plans and other agents' notes are evidence to reconcile.

## Start with the actual scope

1. **Read** the user's request, current repository guidance, and relevant existing
   plans or specs. Inspect enough of the current code to test assumptions.
2. **Identify** the outcome, boundaries, acceptance evidence, constraints, and
   dependencies. Preserve explicit exclusions and compatibility requirements.
3. **Find consequential choices** before assigning implementation: architecture,
   user experience, public APIs, component boundaries, data contracts, and
   migration or compatibility behavior where applicable.
4. **Decide what can proceed** from evidence and judgment. Present unresolved
   product choices to the user for review with concrete options and effects.
   Continue independent work while waiting. If a consequential choice is
   required, record a waiting checkpoint in the plan and **pause dependent work
   until the user decides**; elapsed time is not consent. Resolve routine choices
   without inventing an approval between authorized phases.

For ambiguous design mappings, propose the mapping and its implications before
updating dependent code. Record the chosen contract once, then give workers the
same reference. When shared foundations and consumers both change, settle and
implement the shared contract first; integrate consumers after it is reviewable.
These are dependency rules, not a mandate to create particular components.

## Keep a durable plan

**Before implementation, create or update `plan.md`** in a suitable task location.
If an authoritative plan already exists, extend it or link to it; avoid a second
source of truth. Make the plan useful to someone resuming cold:

- **Scope:** goal, non-goals, explicit exclusions, and acceptance evidence.
- **Constraints:** compatibility, repository workflow, and user decisions.
- **Tasks:** phases or bounded tasks, their dependencies, owners, and current status.
- **Design decisions:** rationale, open questions, and links to source evidence.
- **Verification:** strategy and the exact current and next action.

Before finalizing the task queue, remove work that does not serve the outcome,
merge tasks that serve one result, and reuse shipped solutions when they fit.
Record the reason for each meaningful change without overriding the user's scope.

Use a separate `design.md` or API contract only when complexity makes the plan
hard to read. Link it from the plan. Describe observable interfaces and decisions
before workers depend on them. Source documents and prior proposals inform this
work; check them against the user request and current implementation. Do not
promote a previous agent's proposal to a requirement without that check.

Keep status precise: planned, implementing, implemented, reviewed, verified,
accepted, or waiting on an external gate may mean different things. Name the
evidence for each completed step. An implementation is not verified merely
because its author says it is done, and pending CI or user review stays pending.

**Before assigning a writer, record task readiness** in the plan or brief to show
the task's included and excluded scope, observable acceptance criteria, settled
design and API references where applicable, clear dependencies, and verification
intent. If something is missing, hold that task, record what it needs, and
continue independent ready work.

## Offer a context-clear checkpoint

Once the plan and consequential design choices are settled, **recommend a context
clear before implementation.** Prepare a durable handoff in the plan or a linked
file; do not duplicate the source of truth. Include the agreed scope, design
and API contracts, decisions and rationale, acceptance evidence, dependencies,
branch, absolute worktree path, current baseline, exact next action, required
source document paths, active agent assignments and output locations, and any
unresolved questions. This prevents a resumed session from duplicating workers.
Before the clear, let active writers finish or checkpoint. For runs intentionally
continuing, record how to check their state and recover their output; on resume,
verify their actual state before reassigning. Never assume workers survive reset.

Give the user a copyable fresh-session prompt with concrete paths and first task:

```text
Use orchestrate to resume this effort. Work in <absolute worktree> on <branch>.
Read <plan path> and <contract/source paths>; verify the tree, baseline, and active tasks.
Resume with <exact next task>, subject to <unresolved questions or none>.
```

**The user triggers the clear;** never silently reset or discard context. This is
an optional checkpoint, not an approval gate. If the user chooses to clear, stop
new assignments until the new session resumes. If they continue, proceed with
the plan. During the build, retain supervisor context unless it becomes crowded;
start workers with fresh, bounded contexts.

## Delegate bounded work

**The main thread owns** task breakdown, priority, design decisions, the plan,
integration, review triage, and final synthesis. Assign investigation, coding,
and independent verification as separable tasks. **Prefer a fresh context with
the minimum useful references over a full conversation transcript.**

Assign the next ready, incomplete slice by default. For UI or shared-interface
work, bind the task to the affected surfaces and contract sections, including
consequential reuse or new component locations. When a task is large or needs
further decisions, link a small task spec with an executable slice, files,
acceptance criteria, and checks; simple tasks need no extra spec.

Each assignment should state:

- **Objective:** the goal and acceptance evidence, with exact plan and contract paths.
- **Ownership:** allowed files or area, worktree and baseline, dependencies, and write owner.
- **Constraints:** relevant local rules, permitted checks, and any task-specific constraints.
- **Return:** changed paths, evidence with file and line pointers,
  findings, open questions, and checks actually run.

Use dependency-aware parallel work only when ownership and interfaces are clear.
**Give parallel writers disjoint paths;** do not assign two writers the same file.
Check for uncommitted work before creating another writer's worktree, and follow
local branch, commit, server, test, QA, and shipping rules. A worker should not
infer permission for external mutations from a code assignment.

**Keep raw logs, traces, large code excerpts, and exploration notes out of the
main conversation.** Put substantial evidence in a task-local file when needed
and return a short conclusion with precise pointers. Workers may update only
their assigned files. The main thread alone updates the central plan,
resolves conflicting findings, and changes the task breakdown.

An assignment can use this compact brief:

```text
Goal: <one bounded result>
Read: <plan, contract, and essential source paths>
Own: <allowed paths and worktree>; baseline: <known state>
Depends on: <finished contract or predecessor>
Done when: <observable acceptance evidence>
Checks: <permitted narrow target and question, with time limit; or none>
Return: <changed paths; file:line evidence; findings; open questions>
```

## Integrate and verify

### Review and integration

Review each return against the agreed contract and acceptance evidence.
Inspect the actual diff or artifact; reconcile overlaps and omissions before
starting dependent work. If a shared contract changes outside its assignment,
pause dependent work until the main thread inspects and reconciles that change
with the scope and recorded contract; do not silently adopt or discard it.
Use an independent reviewer for consequential work; give them the criteria,
contracts, and actual diff or artifact, not just the author's summary. Have
reviewers inspect existing evidence without rerunning checks by default. Send
actionable findings back to the author for a bounded correction under local
policy. If the same issue recurs, surface the unresolved issue and revisit the
contract or task split instead of repeating an uninformative review loop.

### Manual review and focused tests

**Make a reviewable implementation available early** with concrete manual steps
and expected behavior. Write or update focused tests for meaningful logic,
state, API compatibility, or regression behavior; avoid cosmetic tests and
tests that merely mirror the implementation.

### Check limits and failures

**Never run full gate suites locally.** When local rules permit it, a writer
may run tests and lint scoped to the paths it changed, using the approved
command or wrapper. After a failure and its fix, **re-run only the failing
specs**, never the whole target. Do not broaden or repeat a green check to seek certainty.
Leave CI to user-authorized shipping under the local workflow, and do not
start servers or attach QA environments merely to validate a branch.

**Bound check runtime.** If a check stalls, stop only that check, retain its output,
and report the limit. An environment or infrastructure failure does not
authorize dependency or tooling repair, a server start, or a wider suite.
Return a real implementation or test failure to its author for correction;
**report unresolved failures and blocked checks explicitly.** Manual review can
still be useful, but pending evidence cannot be described as complete.

Distinguish checks executed now from CI, manual QA, or other pending gates.
Review cross-phase behavior after integration, especially API compatibility,
shared behavior, and explicit scope exclusions.

### Progress and resumption

Update the plan after each phase and whenever a meaningful decision, failure,
or dependency changes the next action. On resumption, read the plan, inspect
the current tree and artifacts, and reconcile status with reality before
assigning more work. Report completion only when the requested outcome and
applicable acceptance steps are actually complete; otherwise state the exact
remaining work and who or what it depends on.

On resumption and in progress reports, give the **current state with supporting
evidence, named blockers, and one concrete next action.** Verify the tree and
active assignments before delegating; do not infer readiness from a status label.

## Host use

Invoke as `/orchestrate` in Claude or `$orchestrate` in Codex. Use the native
delegation tools or locally configured agent runners, following existing model
routing and authorization instructions. Do not create cross-harness child
sessions or interactive T3 threads unless explicitly requested. If delegation
is unavailable, say so briefly and work in bounded slices using the same plan
and evidence discipline.
