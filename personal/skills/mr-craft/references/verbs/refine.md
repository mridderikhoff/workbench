# Mode: `/mr-craft <target>`

Refine reviews the applicable packets for the named target. Architecture goes first because
its findings may move, merge, or delete code that the other packets judge. Route **verify**
rows to a runtime check and apply **fix**, **mandated**, and **default** rows. Raise architecture
**decide** rows mid-run and other decisions at hand-off. Preserve published contracts unless
the PR declares an authorized breaking change.

Use [`--report`](report.md) for a focused, read-only packet list. A refine request can exclude
packets in prose, for example "skip architecture", "no architecture pass", or "checklists
only". Remove each excluded packet from the plan. Without architecture, the other packets
review the target as it stands.

## Packet plan

Resolve the named target (a PR target resolves per [`SKILL.md`](../../SKILL.md) → PR targets, and each resolved folder gets its own plan), then make the plan before reviewing:

| Target | Packets |
| --- | --- |
| Angular target | `angular`, `performance`, `correctness`, and `architecture` on the named target. Split `angular` by numbered section for larger scopes ([`report.md`](report.md) step 3). |
| Other TypeScript libraries or browser test projects | Choose applicable TypeScript, correctness, performance, and architecture probes for the target. |

Record the scoped subtargets in the report. Apply each packet only to the scope it covers.
Architecture, when in the plan, forms phase 1 with one whole-target reviewer subagent, including when
other packets shard. The remaining packets form phase 2. Name any excluded packets in the
hand-off.

## Workflow

0. **Provision** per the [`SKILL.md`](../../SKILL.md) hard rules. Write the run
   directory repo profile before anyone starts and brief its path every time.
   Resolve and record whole-target or diff scope under [report.md](report.md) step 1 before
   gathering evidence or spawning reviewers; forward it to every writer and reviewer.
1. **Gather evidence.** A read-only explorer reads the target, the files it consumes
   ([`schema.md`](../schema.md) → Review scope), and applicable repo profile rule sources. For
   published components, gather known uses and consumer CSS overrides, public exports and
   tracking shapes, documented API and design decisions, and state coverage in
   any relevant documentation and browser tests named in the repo profile. Forward existing rationale and
   named abstractions to architecture. The orchestrator forwards the conclusions and pointers; it does not judge the packet or code.
2. **Review architecture (phase 1).** When `architecture` is in the plan, run it alone on the
   whole target using [`--report`](report.md) steps 3–4. Brief the reviewer with the absolute
   root and gathered evidence. Steps 3–5 apply to its table. Finish phase 1 before starting
   the other packets. When the plan omits architecture, skip this step and step 6 and go to
   step 7.
3. **Verify.** Route each **verify** row to the capability its Action names: use the host's
   computer-use or browser capability for runtime observations, and the available measurement
   capability for performance observations, against a QA surface the user already has running
   that serves the code under review; with no evidence source, leave the row **verify** and
   report it. The check reclassifies the
   row by its stated outcomes, and a resulting **fix**, **mandated**, or **default** row joins the
   apply step.
4. **Apply.** Hand **fix**, then **mandated**, then **default** concerns to writers,
   partitioned by path, including those in a row whose summary Class is **decide**; retain its
   decision concerns. Before handing off, return any row labelled **fix** that would change
   behaviour, rendering, or the public API to its reviewer for reclassification under
   [`schema.md`](../schema.md) → "Classifying a row"; never drop it or hand it to a writer.
   Writers are host general-purpose/default subagents given the closest scoped `AGENTS.md` and
   applicable rule sources by repo profile role. Pass each writer its rows only: it does not
   read the packet and adds no findings of its own. A writer extracting a runtime owner
   moves owner tests with it and retains the parent's integration tests. Within a
   writer's batch, apply rows in probe-id order: renames first, then deletions, then comment
   removal, then neutral `performance` rewrites, and correctness rows last. Minimal
   means subtract, not rewrite: remove what is unjustified and never redesign behaviour a spec
   rule or consumer depends on. For pure subtraction rows in TypeScript, templates, and
   stylesheets, tell the writer to apply them and run nothing. Writers run no tests, gates, or git
   commands. After each batch, the orchestrator runs the repo profile's scoped tests and
   lint for changed paths in each affected project. After failure, rerun only failing specs.
   If there is no scoped command, ask before running anything broader.
   Apply each concern with the test and default record its class requires under
   [`schema.md`](../schema.md) → "Classes". A regression test fails on the defect and passes
   with the correction. An architecture concern follows its own `Class:` label. A writer
   that finds a row would do more than its Action states returns it to the orchestrator for
   reviewer follow-up. The reviewer owns reclassification.

   **Apply ledger.** Track each concern separately. Its key is the row's first probe id (retain
   every merged probe id in the row mapping), with `#<n>` for the n-th labelled concern in a
   multi-concern row, as in `architecture-1.3#2`. Hand only **fix**, **mandated**, and **default**
   concern keys; **verify** and **decide** concerns keep their own class and unresolved state.
   Brief each writer to end its reply with a `## Apply ledger` heading followed only by one
   plain line per handed key, without code fences: `` `<key>` applied —
   <file:line> `` or `` `<key>` returned — <reason> ``. No key is omitted, and there is no other
   writer state. An applied line acknowledges the writer's edit; step 5 independently checks it.
   Before any writer starts, create a unique directory for this phase, round, and apply batch
   under `<run directory>/apply/`, shared by every writer in that batch, and record its parent
   report and concern mapping. Set `batch`
   to that directory and `writer` to the writer's identifier. Write each writer's keys, one per
   line, to `$batch/handed-$writer.txt`; preserve the complete reply in `$batch/reply-$writer.md`.
   Extract every nonblank line after its ledger heading into `$batch/reply-$writer.txt`, retaining
   malformed entries so validation can reject them:

   ```bash
   awk 'ledger && NF { print } /^## Apply ledger$/ { ledger=1 }' \
     "$batch/reply-$writer.md" > "$batch/reply-$writer.txt"
   ```

   Preserve earlier batches, including returned concerns and their reviewer outcomes. Reconcile
   only the extracted ledger with read-only shell commands (a missing heading leaves every
   handed key unanswered):

   ```bash
   key='[a-z]+-[0-9]+\.[0-9]+(#[0-9]+)?'
   # a key handed to two writers, or twice (run before writers start; must print nothing)
   cat "$batch"/handed-*.txt | sort | uniq -d
   # handed rows the writer never answered (must print nothing)
   comm -23 <(sort "$batch/handed-$writer.txt") \
            <(grep -oE "^\`$key\`" "$batch/reply-$writer.txt" | tr -d '`' | sort)
   # keys the writer answered that were never handed to it (must print nothing)
   comm -13 <(sort "$batch/handed-$writer.txt") \
            <(grep -oE "^\`$key\`" "$batch/reply-$writer.txt" | tr -d '`' | sort)
   # reply lines outside the two states; applied needs a path:line (must print nothing)
   grep -vE "^\`$key\` (applied — [^[:space:]]+:[1-9][0-9]*|returned — [^[:space:]].*)$" "$batch/reply-$writer.txt"
   ```

   A missing, unknown, duplicated, or malformed line goes back to the same writer in one follow-up
   that names it; the orchestrator never applies, fills in, or reclassifies a row itself. Each
   **returned** row goes to its reviewer for reclassification, as above, and joins the apply step
   again only under its new class.
5. **Re-review.** After a writer changes a file, including a mandated edit and its test,
   re-review only the packets whose `## Files reviewed` files changed since that packet's last
   table. Record `HEAD` when each packet's table is written, then compare that commit with the
   working tree: `git diff --name-only <that commit>` plus `git ls-files --others
   --exclude-standard -- <target>`, against the list. Any new file inside the target affects
   every packet. An unaffected packet keeps its last table and coverage, and the hand-off names
   the packets that kept earlier tables. An applied **mandated** or **default** row or
   architecture concern that changes rendering or keyboard or focus behaviour gets step 3's
   runtime check after its batch; one check covers every such row in the batch. When that
   check cannot run, the edit stays applied and
   committed, and its row is reported as "applied — unverified", never as verified. The final
   report describes the edited tree. The writer never reviews its own edits. When an applied
   row adds code (a helper, wrapper, member, element, or branch), the re-review also runs the
   `angular` subtraction section against that added code, so a refine edit never lands
   code the next pass would delete. Intermediate re-reviews may resume the original reviewer
   to check its applied rows, and cover only the diff since that packet's recorded `HEAD`;
   the last round of each packet in each phase is a fresh reviewer
   spawn with no prior table, briefed like an initial review on the current tree, never asked
   to confirm earlier rows or to report only rows that still carry a class. Stop each phase
   after three write/re-review rounds, the third being that fresh pass, and report its
   remaining **fix**, **mandated**, and **default** rows. The orchestrator commits completed
   changes in the feature worktree at step 7's checkpoint and before hand-off.
6. **Settle architecture decisions.** Escalate the architecture **decide** concerns through
   the host's question capability and wait. Format and order them as
   [`report.md`](report.md) step 5 → Decisions states, escalating only those whose prerequisites
   are settled and the rest as each is. An answer is authorization to apply it in phase 1:
   the orchestrator returns it to the architecture reviewer, which restates the row with the
   chosen option as its Action, its class, and the regression test that class requires; a
   writer applies it under step 4, and architecture is re-reviewed under step 5. These rounds
   count toward step 5's three-round phase cap; answered decisions join the next open round
   rather than starting their own. A deferred
   decision, and any architecture **decide** concern a later re-review raises, is recorded and
   returns in the hand-off. With no architecture **decide** concern, ask nothing and continue
   to phase 2 without waiting. Phase 1 ends here.
7. **Review the other packets (phase 2).** When phase 1 changed files, the orchestrator first
   commits that work in the feature worktree as a checkpoint and refreshes step 1's evidence
   for the files it moved, merged, or deleted. Then run the remaining packets in the plan once
   on the current tree using [`--report`](report.md) steps 3–4, briefing reviewers with the absolute root
   and current evidence. Preserve every table; do not narrow the plan (step 5 narrows re-reviews only). Run steps
   3–5 on these packets.
8. **Hand off.** Include [report.md](report.md) step 5's execution sentence and tested revision.
   Report the final tables and coverage, plus the accumulated concern ledger from
   every batch, including concerns absent from the final tables. Each handed concern carries
   **applied** with its re-review outcome, **returned** with the reviewer's outcome, or **open**
   after the three-round cap. An applied claim still found defective by re-review stays open;
   **verify** and **decide** concerns retain their unresolved class. A mixed row never gets one
   apply state for all its concerns. Then report these groups separately: the
   architecture decisions answered in phase 1, each with what was applied; applied **fix**
   rows; applied **mandated** rows with their tests; "Defaults taken — override if wrong", one
   line per applied **default** row with its evidence and the override act; "applied —
   unverified" rows; **verify** rows left unresolved, with the reason; the debt and readiness
   lists; the **decide** questions (every **decide** row still open from either phase), as
   [`report.md`](report.md) step 5 → Decisions states; then
   the architecture top two where applicable; **Proposed guidance updates** under
   [`SKILL.md`](../../SKILL.md) → "Commands"; and the committed feature worktree. Draw proposals
   from every wildcard row, every row whose probe recommends the defect it finds, and every
   defect under `## Outside this review's scope`. Write each proposal per [guide.md](guide.md)
   steps 1–4 so that "apply" is enough to run guide mode on it. External actions follow the
   hard rules. Include the repo contract hand-off when the profile lists a contract packet.
   The human answers decisions and overrides defaults by exception; a follow-up run applies an answer or
   an override. Do not expand into follow-up work unless explicitly asked.
