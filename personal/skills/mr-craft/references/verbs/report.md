# Mode: `--report [packets]`

`/mr-craft <target> --report [packets]` is a read-only review. It writes only its run artifacts in the location selected by the repo profile, and follows the [`SKILL.md`](../../SKILL.md)
hard rules.

## Steps

0. **Profile the repository.** Use [repo-profile.md](../repo-profile.md) to discover
   the root, supported targets, gates, rule roles, and run directory. Write
   `<run directory>/repo-profile.md` before briefing any reviewer. Use it in the
   remaining steps.
1. **Resolve the target.** A PR resolves under [SKILL.md](../../SKILL.md) → PR targets.
   Confirm the folder exists and is supported by the repo profile. A missing path requires
   clarification. For PRs, record `baseRefOid` and `headRefOid`; for branches, record the
   supplied base or merge base and initial head. Use `git diff --name-status --find-renames
   <base>...<head>` limited to supported projects. Keep old rename paths and map changed
   `.ts`, `.html`, `.css`, and `.scss` files by feature folder. Give every reviewer the same
   scope. A bare path has whole-target scope. A named component resolves to an exact folder
   name among supported targets; ask if several match. If a PR has no changed source files
   in supported projects, report that and stop before assigning packets.
2. **Pick the packets.** The user's list wins. Otherwise use `angular`, `performance`,
   and `correctness` for Angular/TS work. Add `architecture` for a single component or
   directive family. Use only `architecture` for `--report architecture`. For a wider
   target, include architecture when an abstraction or boundary is in scope. Published
   component contracts are handed to the repo craft skill named in the profile. A mixed
   report retains every selected packet's findings; never fold architecture into another
   packet.
3. **Assign the packets following [the packet reviewer task](../reviewer.md).** Brief
   each reviewer with the profile path and the inputs in
   [`SKILL.md`](../../SKILL.md) → Spawning the reviewer.
   Run live reviews in parallel where the host allows it.
   For a whole library or app, shard non-architecture packets by direct child folder
   containing components. Find the component or feature folders under the code root, such
   as `src/lib` or `src/app`. When there are no useful child scopes, keep the named folder.
   Each child gets its own consumed-file scope
   ([`schema.md`](../schema.md) → Review scope) and `<packet>-<child>.md` in the run directory.
   Assign one whole-target reviewer
   to `architecture`, writing `architecture.md` for a path target. Architecture may inspect
   bounded related code to assess design across abstractions.
   A small target is one component or directive family folder with at most 8 non-spec source
   files (`.ts`, `.html`, `.scss`); it gets one
   [`angular`](../packets/angular.md) reviewer for the whole packet, writing
   `angular.md`. For a larger or sharded target,
   [`angular`](../packets/angular.md) is split by its numbered top-level
   sections: one reviewer per `## <n>.` section (names, subtraction, CSS, comments, tests, other
   material concern; skip a section the packet marks as owned by another packet), each briefed
   with that section heading, answering only that section's probes, and writing
   `angular-<n>.md` (`angular-<n>-<child>.md` when also sharded by child). On a larger
   target, one reviewer answering every craft section in one pass spreads its attention too thin
   to find subtraction and naming defects reliably.
   For a PR, prefix report filenames with `<folder-slug>--`, including section or child
   suffixes when used. Retain separate round files when refining. Before each spawn,
   generate its report file with the skeleton command in
   [`SKILL.md`](../../SKILL.md) → Spawning the reviewer.

   Use the host's supported delegation tools and concurrency limit. Batch only as the
   hard rules allow, keeping one report per packet and scope. Associate each planned
   report with the returned task handle in the existing packet plan; the host owns queued,
   running and terminal states. A banner, created skeleton or task submission alone is not
   evidence that a reviewer ran. Follow the host's completion notifications and bounded-wait
   rules. On a launch error, terminal failure or reported timeout, report the affected task
   and recover through that host; stop a superseded task before replacing it. Never wait for
   an arbitrary count of exit files or create a shell polling loop. If the host requires a
   CLI launcher, capture its full output and exit status before extracting a summary; never
   pipe the launcher into `head`, `grep -m1`, or another consumer that closes early. Check its
   documented worker or queue evidence before treating the launch as accepted.
4. **Check coverage, then merge the finding rows.** After the planned reviewers return,
   run the read-only coverage check once with the planned report paths. Pass each path
   explicitly to exclude reports from other rounds.

   ```bash
   node <skill-dir>/scripts/report-check.mjs <report file> [<report file> ...]
   ```

   Keep the skeleton headings and place empty-form probe rows in the Coverage table, with
   classed rows in Findings. Architecture also fills Architecture as found and Abstractions
   reviewed per [`schema.md`](../schema.md) → "Report layout". The skeleton metadata
   selects the packet and section. The checker rejects
   missing reports, missing or duplicate probe answers, unknown ids, inconsistent coverage,
   placeholders, unresolved imports and evidence-less empty rows. It reads report files and
   packet ids only; it neither scans source again nor judges findings. Keep the planned report
   paths even when a reviewer fails, so missing work cannot disappear from the batch. A passing
   check establishes coverage, not a clean verdict or successful task execution. Check the
   host's terminal outcomes as well; use the existing findings and apply ledger for concerns,
   with no parallel status document or extra reviewer.

   Check that `## Files reviewed` includes every direct first-party import outside the
   target folder. Resolve relative imports and package aliases with the repo profile and
   skeleton metadata. A listed path establishes scope. Evidence of actual review and coverage
   beyond the first hop require reviewer judgment.

   Screen each **decide** row against [`schema.md`](../schema.md) → "Classifying a row" and
   "Defaults for recurring cases". Treat the target's rationale as the claim under review.
   Send missing ids, missing files, remaining `TODO` placeholders or
   `<!-- unresolved: … -->` entries, evidence-less rows, and failed
   **decide** rows back to the same spawn in one follow-up briefing that names them; never fill
   in or reclassify a row from the orchestrator. The follow-up names only the failed condition
   and any recurring-case row that resolves it; it never adds sources, siblings, or a direction.
   When the original spawn has ended, brief
   a fresh reviewer for that probe the same way. Then merge the rows the
   reviewers returned, keyed by probe id, and record above each table which spawn produced it.
   When two non-architecture reports name the same `file:line` for the same defect, keep one
   row, name every probe id, and keep the longer Action, except that a `correctness` row keeps
   its result and test and appends the other row's further change. The merged row takes the
   most human-facing class, labels each concern with its own class, and only **decide**
   concerns enter the decision list. Architecture rows stay separate. Retain each concern's
   class independently of the row's summary class. See [refine.md](refine.md) step 4 for
   applying findings. Merge repeated readiness items by act and list every affected target. A cross-packet reference inside a packet
   (for example "see `angular` § 6") is addressed to the orchestrator, which checks that the
   referenced packet's table covers the row; a single-packet reviewer never resolves one.
5. **Report.** Return the following in the conversation. A PR description update requires
   a separate request.
   - The merged **fix**, **mandated**, **default**, **verify**, and **decide** rows.
   - **Defaults taken — override if wrong**: one line per **default** row, `<choice> —
     <evidence>; override: <act>`. The human reads this by exception after the fact.
   - **Decisions**: the **decide** concerns, each as the question, the options with what each
     changes, the sources read, and the lean, numbered Q1, Q2, …. With a lean, word the question
     so "yes" accepts it; with `No lean`, give the options as lettered choices. A question whose
     answer depends on another open one is listed as waiting ("after Q2") and asked once that one
     is settled; questions with no open prerequisite are asked together in one round. A simple
     component normally has none; two or more on one component is a signal to re-screen each
     against the escalation test before reporting.
   - The **Debt** and **Readiness** lists.
   - `Coverage: <answered> of <total> probes examined`, where `<total>` counts the probe ids in
     the packets that ran; a `performance` table without a measurement adds `Performance
     verdict: static only`.
   - One sentence counting the open **fix**, **mandated**, **default**, **verify**, and
     **decide** concerns.
   - One execution sentence from the host task results: planned/completed/failed/pending
     reviewers and the reviewed commit. If any task or coverage check is incomplete, say so;
     never call a phase clean because its round limit was reached. Runtime evidence names
     the commit it checked; do not present an earlier revision as final verification.
   - When architecture ran, its open concerns ranked by architectural impact and adoption
     timing (compatibility and migration effort give context but never lower a rank), then the
     top two to raise, or a statement that none were found; no minimum number of concerns, and
     no re-review while ranking.
   - In the conversation only, ` — full report: <run directory>` appended.

## Architecture report

`--report architecture` runs only the [`architecture`](../packets/architecture.md) packet on the
whole target: do not add the target's default packets unless the user also asks for them.

## Stop condition

The report ends the run. Verifying and applying findings is the default
[`refine`](refine.md) mode; do not start it from here without being asked.

For a focused behavior review, use `/mr-craft <component-folder> --report correctness`.
