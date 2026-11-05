#!/usr/bin/env bash
# PreToolUse (Bash): block `wt qa <branch>` unless the user asked to attach QA this turn.
#
# Attaching the shared QA runtime to a branch is human-triggered per request. This guard
# denies an agent-initiated attach on any turn where the user's own message didn't ask
# for it (no marker from wt-qa-intent.sh). Bare `wt qa` (status only) is never gated, and
# a non-`wt qa` command is left untouched.
set -u

marker="$HOME/.claude/.wt-qa-attach-intent"
input="$(cat)"
cmd="$(printf '%s' "$input" | jq -r '.tool_input.command // ""')"

# Match `wt qa <branch>`: `wt qa` at a word/path boundary, then a branch-like argument.
# Bare `wt qa` (nothing, or only flags, after) does not match and stays allowed.
if printf '%s' "$cmd" | grep -Eq '(^|[[:space:]/])wt[[:space:]]+qa[[:space:]]+[A-Za-z0-9._/]'; then
  if [ ! -f "$marker" ]; then
    cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"Attaching the QA runtime to a branch (wt qa <branch>) is human-triggered and this turn's user message did not ask for it, so the attach is blocked. Shipping, finishing work, or saying QA is next does not count. Bare `wt qa` (status only) is always allowed. If an attach is wanted, ask the user to say so in their next message (or to run `! wt qa <branch>` themselves) — do not retry this command."}}
JSON
  fi
fi
exit 0
