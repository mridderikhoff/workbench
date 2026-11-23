#!/usr/bin/env bash
# PostToolUse(Monitor|Bash): inside T3 Code, tell the agent to register new background work
# with t3_background_wait. T3 marks a thread done when the turn ends; a Monitor or a
# background Bash command alone does not keep it Working, so threads waiting on codex
# looked finished.
set -u

[ -n "${T3CODE_THREAD_ID:-}" ] || exit 0

input="$(cat)"
task_id="$(printf '%s' "$input" | jq -r '.tool_response | objects | (.taskId // .task_id // .backgroundTaskId) // empty' 2>/dev/null)"
[ -n "$task_id" ] || exit 0

jq -n --arg id "$task_id" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("T3 Code host: call mcp__t3-code__t3_background_wait with taskIds [\"" + $id + "\"] before ending this turn (load it with ToolSearch first), so the thread stays Working while this background task runs. Skip only if it is something left running on purpose, such as a dev server.")
  }
}'
