#!/usr/bin/env bash
# PostToolUse(Monitor): inside T3 Code, tell the agent to register the new Monitor with
# t3_background_wait. T3 marks a thread done when the turn ends; a Monitor alone does not
# keep it Working, so threads waiting on a codex digest looked finished.
set -u

[ -n "${T3CODE_THREAD_ID:-}" ] || exit 0

input="$(cat)"
task_id="$(printf '%s' "$input" | jq -r '.tool_response.taskId // .tool_response.task_id // empty' 2>/dev/null)"
[ -n "$task_id" ] || exit 0

jq -n --arg id "$task_id" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: ("T3 Code host: call mcp__t3-code__t3_background_wait with taskIds [\"" + $id + "\"] before ending this turn (load it with ToolSearch first), so the thread stays Working while this Monitor runs. Skip only if the Monitor watches something left running on purpose, such as a dev server.")
  }
}'
