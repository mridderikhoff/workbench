---
name: codex-implementation
description: Ask Codex CLI (gpt-6-luna or gpt-6-sol) to implement scoped code changes in the current repository. Claude then inspects the diff, runs verification, and hands the change to cross-review.  This is how gpt-6 is invoked for implementation work.  Use when the user asks Claude to delegate implementation to Codex or gpt-6, when the model-selection rubric routes the work to gpt-6, or when a bounded task would benefit from another coding agent producing a patch.
---

# Codex Implementation

Use Codex as a separate implementation agent for bounded code changes. Claude stays responsible for:

- scoping the task
- inspecting the diff
- running verification
- routing the result to review
- explaining the final result

Do not let Codex commit, push, deploy, or edit global config unless the user explicitly asked for that.

## Workflow

1. Pin a baseline. Run `git status --short` and note any user changes already present. Outside git, or when unrelated uncommitted changes exist, snapshot the target files to the scratchpad. `cross-review` diffs against this baseline.
2. Define the scope: the files or behavior to change, files to avoid, constraints, and verification commands.
3. Pick the model from the routing table in `~/.claude/CLAUDE.md`:
   - `gpt-6-luna` for bulk or mechanical work
   - `gpt-6-sol` for standard work with a clear spec
   - Claude (Sonnet 5.5 or Opus, per the routing table), not codex, for user-facing parts (UI, copy, public API design)
4. Delegate using the protocol below.
5. Inspect the changes: `git status` and `git diff`, and for spec files, the `it(` counts (see below).
6. Run the cheapest reliable verification yourself.
7. Run the `cross-review` skill for standard or high-risk work. It gets a fresh Claude review (Sonnet 5.5 standard, Opus high-risk), and codex fixes the confirmed findings through `codex-run --resume <this run's artifact dir>`. For trivial work, the diff read in step 5 is enough.
8. Report what codex changed, what Claude verified, the review outcome, and any remaining risks.

## Delegation Protocol

Follow the protocol in `~/.claude/scripts/README.md`: one `codex-run` call, relay the artifact dir, arm the `codex-digest` Monitor, and read `report.md` when it finishes. Skill-specific parts:

```bash
~/.claude/scripts/codex-run --mode exec --label "<label>" --model gpt-6-sol --sandbox workspace-write <<'PROMPT'
<self-contained prompt>
PROMPT
```

- Use the Bash description `Delegate to codex (<model>): <label>`.
- `workspace-write` is the default sandbox. Use `danger-full-access` only when the work truly needs machine-level access, such as paths outside the repo, launching apps, simulators, or global package-manager state.
- Add `--cwd <repo>` when the target is not the current directory, and `-- --skip-git-repo-check` when it is not a git repo.
- Keep the artifact dir. The fix run resumes from it.

## Prompt Requirements

With `workspace-write`, the wrapper adds the sandbox rules: no network, report EPERM instead of working around it, scratch files go in the artifact dir, and keep existing tests. With `danger-full-access` it adds nothing, so put the scratch-file and keep-existing-tests rules in the prompt yourself. Tell Codex:

- The exact implementation goal and acceptance criteria.
- The repo path and branch context, if relevant.
- Which existing patterns, files, or tests to inspect first.
- Files or behavior that must not change.
- To preserve unrelated user changes, and not to commit, push, deploy, or edit global config.
- The exact verification commands to run, or to explain why any were skipped. Don't say "run the tests". Leave out tests that bind a port.
- When it edits spec files: report the `it(` count per file before and after. Codex has deleted passing tests to make a suite green, and the count is how you catch that.
- To finish with a concise report: files changed, verification, and unresolved questions.

Keep the task bounded. If it bundles several substantial changes, split it into separate runs, or ask the user which to do first.

## Example Prompt

```text
You are implementing a scoped change for Claude.

Repository: /absolute/path/to/repo
Artifact directory: {{ARTIFACT_DIR}}

Goal:
- Add retry with exponential backoff to the HTTP client in src/api/client.ts.

Acceptance criteria:
- Retries 5xx and network errors up to 3 times (200ms, 400ms, 800ms).
- Never retries 4xx responses or non-idempotent methods (POST, PATCH).
- The public client API is unchanged.
- Existing client tests keep passing.

Constraints:
- Preserve unrelated user changes.
- Do not commit, push, deploy or edit global config.
- Follow existing HTTP client and test patterns.

Verification:
- Run `pnpm vitest run src/api/client.spec.ts` and `pnpm run typecheck`.
- Report the it( count of client.spec.ts before and after.

Report:
- Files changed
- Behavioral summary
- Verification run and result
- Anything blocked or uncertain
```

## Inspecting Codex's Diff

- **Always inspect the diff** before telling the user the work is done.
- **Spec files:** compare `grep -c "^\s*it(" <file>` against the pre-run count. A drop the task didn't ask for is a defect, not a cleanup.
- **Reverting:** revert only mistakes Codex created, and only when you are sure they are not user changes.
- **Stop and report** with a diff summary if Codex leaves the repo in a worse state or changes unrelated files.
- **Stalls or failures:** if codex stalls twice or fails review twice on the same task, the routing table moves it to Opus.

If `codex` is not installed (wrapper exit 127) or the run fails, report the error and offer to do the implementation directly.
