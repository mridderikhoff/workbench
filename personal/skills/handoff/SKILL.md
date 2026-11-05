---
name: handoff
description: Write a handoff.md to a temp path so another agent (Claude Code or Codex) can continue the current work cold. Use when the user says "handoff", "recap for another agent", "write a handoff", or context is getting long and the work must continue in a fresh session.
---

# Handoff

Produce one Markdown file that lets a fresh agent with no conversation history pick up exactly where this session stopped. Write for a reader who knows the codebase but saw none of this conversation.

## Steps

1. Create the file path and directory:

   ```bash
   dir="${TMPDIR:-/tmp}/handoff"; mkdir -p "$dir"
   repo="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
   file="$dir/$repo-$(date +%Y%m%d-%H%M%S).md"; echo "$file"
   ```

2. Gather live facts before writing, never from memory: `git rev-parse --abbrev-ref HEAD`, `git status --short`, `git log --oneline -5`, the worktree path (`git rev-parse --show-toplevel`), and any PR URL or ticket id mentioned in the session.

3. Write the file using the template below. Be concrete: absolute paths, `file:line` pointers, exact commands, exact error text. Drop any section that is genuinely empty. Target 40–120 lines.

4. Reply with only the path and a copy-pasteable prompt for the next agent:

   ```
   Read <path> and continue from "Next steps". Verify the state section against the tree before editing.
   ```

## Template

```markdown
# Handoff — <one-line task title>
Written: <ISO timestamp> · From: <claude|codex> · Repo: <name> · Branch: <branch> · Tree: <absolute path>

## Goal
What the user asked for, in their terms. Include constraints they set (scope limits, "don't touch X", conventions).

## State
- Done: …
- In progress: … (what is half-finished and where)
- Not started: …
Tree status: clean | uncommitted changes in <files> | last commit <sha> <subject>

## Decisions and facts
Things settled during the session that the next agent must not re-derive or reopen. One line each, with the reason.

## Pointers
- `path/to/file.ext:line` — why it matters
- Commands that work (tests, build, run), verbatim.

## Next steps
1. Ordered, concrete, starting with the very next action.

## Open questions / blockers
Anything only the user can answer, and anything tried that failed (with the error).

## Gotchas
Traps hit this session: flaky tests, hooks that refuse edits, paths that need a worktree, etc.
```

## Rules

- Never paste secrets, tokens, or `.env` contents. Reference the variable name only.
- Do not summarize the conversation chronologically; describe the current state and what is next.
- Do not edit repository files or commit as part of a handoff.
