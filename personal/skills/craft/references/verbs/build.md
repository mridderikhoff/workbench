# Mode: `/craft <task>`

Build writes Angular/TypeScript work from a task. It chooses read-only triage by default,
or full [refine](refine.md) when the work is final. It takes no flags.

## Workflow

1. **Provision** per [SKILL.md](../../SKILL.md). Select the run directory and write
   the repo profile before briefing anyone.
2. **Resolve the project.** Read the task and supported targets in the repo profile. Load
   rule sources by role: `angular`, `scss`, `i18n`, `comments`, `component-library`, and
   `conventions` as applicable. If the profile names a visual-design skill and the task
   needs visual design judgment, use it. Published component contracts belong to the repo
   craft skill named in the profile.
3. **Brief a writer.** Give one host writer the task, clean worktree root, repo profile path,
   acceptance list, and relevant source revisions for a port. Give the packet sections
   routed by [SKILL.md](../../SKILL.md) → Packets and [writer-digest.md](../writer-digest.md).
   The writer reads those sections before writing, writes or updates focused tests, and
   checks changed files against the same sections. Its reply accounts for each acceptance
   item with a file or test pointer or names it missing. A port identifies retained tests
   and justifies removed cases. This self-check is not an independent review.
4. **Check and checkpoint.** After each writer batch, use the profile's scoped typecheck.
   Before manual QA, use its scoped tests and lint for changed paths. Return a failure to
   the writer and rerun only failing specs. If no scoped command exists, ask before a
   broader command. Reconcile acceptance with the changed-file and test inventory. Return
   missing behavior or an unexplained rewrite to the writer. Commit completed work in the
   feature worktree when the host workflow calls for a checkpoint.
5. **Choose review depth.** Run [refine](refine.md) on changed folders when the request says
   work is final or triage finds a mandated or decide row. Otherwise run read-only
   [report](report.md) with `angular` and `correctness` on changed folders. No architecture
   reviewer or refine writer is needed for triage.
6. **Hand off.** Report acceptance notes, classed rows, and the command for a full pass,
   `/craft <changed folder>`. Triage does not replace independent refine. Include the repo
   contract hand-off from [SKILL.md](../../SKILL.md) when applicable.
