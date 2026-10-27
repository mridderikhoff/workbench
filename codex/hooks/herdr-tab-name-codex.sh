#!/usr/bin/env bash
# Codex-side adapter for the shared Herdr tab-naming hook.
#
# The naming logic lives once, in ~/.claude/hooks/herdr-tab-name.sh. That script
# expects a Claude Code hook payload; this wrapper normalises Codex's payload into
# that shape and pipes it through, so only the schema adaptation is duplicated.
#
# Installed beside the herdr-managed ~/.codex/herdr-agent-state.sh rather than inside
# it: that file is overwritten whenever the Herdr integration is reinstalled.
#
# Usage (from ~/.codex/hooks.json):
#   bash '/home/marica/.codex/hooks/herdr-tab-name-codex.sh' SessionStart
#   bash '/home/marica/.codex/hooks/herdr-tab-name-codex.sh' UserPromptSubmit
#
# The event name comes from argv, not from the payload: Codex's field names for
# prompt/session are not contractually stable across releases, so every field below
# is read through a fallback chain and the one value that must be right is passed in
# explicitly. See ~/.claude/codex-claude-mapping.md.

set -uo pipefail

readonly TARGET='/home/marica/.claude/hooks/herdr-tab-name.sh'

event=${1:-}
case "$event" in
  SessionStart | UserPromptSubmit) ;;
  *) exit 0 ;;
esac

# Cheap bail-outs before touching jq, matching the target script's own guards.
[ "${HERDR_ENV:-}" = '1' ] || exit 0
[ -n "${HERDR_TAB_ID:-}" ] || exit 0
[ -f "$TARGET" ] || exit 0
command -v jq >/dev/null 2>&1 || exit 0

input=''
IFS= read -r -d '' input || true
[ -n "$input" ] || input='{}'

normalised=$(jq -c \
  --arg event "$event" '
  # Non-string and absent candidates are dropped rather than coerced, and each
  # nested lookup is wrapped in `try`: a payload whose `prompt` is an object (or a
  # string, where the nested path would raise) must not abort the whole program.
  def first_str(candidates):
    (candidates | map(select(type == "string" and length > 0)) | first) // "";
  {
    hook_event_name: $event,
    session_id: first_str([.session_id?, .thread_id?, .conversation_id?, .id?]),
    prompt: first_str([.prompt?, .user_prompt?, .message?, .text?, .input?,
                       (try .prompt.text catch null),
                       (try .message.text catch null)]),
    source: first_str([.source?, .session_start_source?])
  }
' <<<"$input" 2>/dev/null) || exit 0
[ -n "$normalised" ] || exit 0

# Claude's SessionStart entry is matcher-scoped to `clear|startup`; Codex has no
# matcher equivalent, so the same narrowing happens here — a resume must not wipe
# the label the resumed session was named after. An absent source means reset.
if [ "$event" = 'SessionStart' ]; then
  source_kind=$(jq -r '.source' <<<"$normalised" 2>/dev/null) || source_kind=''
  case "$source_kind" in
    '' | startup | clear | new) ;;
    *) exit 0 ;;
  esac
fi

# The target reads its payload as a NUL-terminated slurp.
printf '%s\0' "$normalised" |
  HERDR_TABNAME_LLM=codex bash "$TARGET" >/dev/null 2>&1 || true
exit 0
