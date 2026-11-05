---
name: codex-review
description: Ask Codex CLI (gpt-6-sol, or gpt-6-astra for high-risk work) for an independent code review of Claude-written changes, a branch diff, a commit, or a specific implementation.  This is how gpt-6 is invoked for review work.  Use when cross-review routes Claude-authored work to gpt-6, when the user asks Claude to have Codex or gpt-6 review work, or when Codex should audit a diff, find bugs or regressions, or compare an implementation against requirements. gpt-6-authored work is reviewed by a fresh Claude subagent (Sonnet 5.5 standard, Opus high-risk) through cross-review instead.
---

# Codex Review

Use Codex as the independent, other-family reviewer for work Claude wrote. The `cross-review` skill decides when a review is needed, from the risk tiers in `~/.claude/CLAUDE.md`. This skill covers how to run one. Treat Codex's output as evidence, not authority.

## Workflow

1. Identify the target and gather the packet: the acceptance criteria, the diff, and the verification output. `cross-review` step 2 builds these files.
2. Delegate using the protocol below.
3. Check the important claims against the code, then triage (see Reporting Back).

## Delegation Protocol

Follow the protocol in `~/.claude/scripts/README.md`: one `codex-run` call, relay the artifact dir, arm the `codex-digest` Monitor, and read `report.md` when it finishes. Skill-specific parts:

**Default: a criteria-aware review in exec read-only mode.** Without the criteria, gpt-6 can only find generic bugs. It can't catch "this doesn't do what was asked."

```bash
~/.claude/scripts/codex-run --mode exec --label "<label>" --model gpt-6-sol --sandbox read-only <<'PROMPT'
<review prompt with the packet paths>
PROMPT
```

- Use `--model gpt-6-astra` for high-risk work.
- **Never give a review run `workspace-write`.** The read-only preamble also stops codex from spending 20 minutes fighting EPERM.
- **Name the target explicitly**, including untracked files, which `git diff HEAD` doesn't show. Best is to point at the packet's `change.diff`.
- **Outside git**, add `--cwd <dir>` and `-- --skip-git-repo-check`.
- Use the Bash description `Delegate to codex (<model>): <label>`.

**Ad hoc: a plain diff review with no criteria.** Use this when the user just says "have codex look at this":

```bash
~/.claude/scripts/codex-run --mode review --label "<label>" --model gpt-6-sol -- --uncommitted <<'PROMPT'
<review prompt>
PROMPT
```

Other targets are `-- --base main` and `-- --commit <sha>`. `--sandbox` is ignored in review mode. Review runs send no progress lines, so the Monitor only delivers the finish line.

## Review Prompt

```text
You are an independent reviewer. Do not edit files. Do not run tests, typecheck, lint, build or nx; read the code and reason. The caller has already run verification.

Read first:
- Acceptance criteria: <path to criteria.md>
- Diff: <path to change.diff>
- Verification already run: <path to verification.md>

Review for bugs, regressions, missing tests, security issues, and mismatches with the criteria. Also say whether the criteria themselves have gaps that the change exposes.

Findings first, most severe first. For each:
- severity (high / medium / low)
- file:line
- the concrete failure scenario
- a suggested fix direction

Then one line on what you checked and found fine. If there are no substantive findings, say so and name any residual test gaps.
```

Keep the target small enough to read in a few minutes: one feature's diff, with the files that matter most named. A whole-branch review of many files is the run most likely to stall. Add task-specific context when it helps, such as risky areas, intent, or files you're unsure about.

## Reporting Back

- **Check before relaying.** Inspect the cited code, or reproduce the issue when that's cheap, before passing a finding on.
- **Sort every finding** as *confirmed*, *rejected* (with a one-line reason), or *unverified*. Show the user all three, including the rejected ones.
- **Hand fixes back** as `cross-review` step 6 describes. Claude authored the code, so Claude fixes it.
- **If Codex finds nothing,** say so clearly and name the target it inspected.

If `codex` is not installed (wrapper exit 127) or the run fails, report the error and offer a review by a fresh Opus subagent instead. Say plainly that it is a same-family review.
