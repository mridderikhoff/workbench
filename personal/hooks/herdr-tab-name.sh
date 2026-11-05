#!/usr/bin/env bash
# Names the enclosing Herdr tab/pane after the first prompt of each Claude session,
# and resets to a neutral label on /clear and startup.
#
# Custom hook, installed beside the herdr-managed herdr-agent-state.sh rather than
# inside it: that file is overwritten whenever the Herdr integration is reinstalled.
#
# See ~/.claude/herdr-tab-naming.md for wiring and removal.

set -uo pipefail

readonly RESET_LABEL='clean'
readonly METADATA_SOURCE='tabname'
readonly LABEL_MAX_CHARS=40
readonly LLM_INPUT_MAX_CHARS=600
readonly CLAUDE_MODEL='haiku'
readonly CODEX_MODEL='gpt-5.4-mini'
readonly LLM_TIMEOUT_SECONDS=30
readonly LLM_MAX_WORDS=6
readonly LLM_INSTRUCTION='Summarize this coding-session request as a terminal tab label: 3-4 words, lowercase, no punctuation, no quotes. Reply with the label only.'
# Print-mode inherits the user settings, whose default permission mode is permissive.
readonly LLM_SETTINGS='{"permissions":{"deny":["Bash","Edit","Write","Read","Glob","Grep","WebFetch","WebSearch"]}}'

readonly SELF=${BASH_SOURCE[0]}

log_debug() {
  [ "${HERDR_TABNAME_DEBUG:-}" = '1' ] || return 0
  printf '%s\n' "$*" >>"${TMPDIR:-/tmp}/herdr-tabname.log" 2>/dev/null || true
}

state_file_for() {
  # Tab ids contain a colon; keep the state filename boring.
  printf '%s' "${TMPDIR:-/tmp}/herdr-tabname-${1//[^a-zA-Z0-9]/_}"
}

rename_tab() {
  herdr tab rename "$HERDR_TAB_ID" "$1" >/dev/null 2>&1 || true
}

set_pane_title() {
  [ -n "${HERDR_PANE_ID:-}" ] || return 0
  herdr pane report-metadata "$HERDR_PANE_ID" \
    --source "$METADATA_SOURCE" --title "$1" >/dev/null 2>&1 || true
}

clear_pane_title() {
  [ -n "${HERDR_PANE_ID:-}" ] || return 0
  herdr pane report-metadata "$HERDR_PANE_ID" \
    --source "$METADATA_SOURCE" --clear-title >/dev/null 2>&1 || true
}

# `herdr tab rename` takes the label as a trailing variadic arg and does not honour
# `--`, so a leading hyphen would be parsed as a flag.
strip_leading_hyphens() {
  local value=$1
  printf '%s' "${value#"${value%%[!-]*}"}"
}

tidy_spaces() {
  local value=$1
  while [[ $value == *'  '* ]]; do value=${value//  / }; done
  value="${value#"${value%%[![:space:]]*}"}"
  printf '%s' "${value%"${value##*[![:space:]]}"}"
}

# --- detached refinement pass -------------------------------------------------
# Runs out of band so prompt submit never waits on a model call. The truncated
# label is already on screen by the time this starts; a good answer replaces it,
# anything doubtful leaves it alone.

refine_label() {
  local session=$1 text=$2
  [ -n "$text" ] || return 0

  local raw
  case "${HERDR_TABNAME_LLM:-claude}" in
    codex)
      command -v codex >/dev/null 2>&1 || return 0
      # Run outside the repository and without hooks or persistent state. This keeps
      # a three-word label from loading project instructions or recursively naming
      # its own ephemeral Codex session.
      raw=$(printf '%s\n\n---\n%s\n' "$LLM_INSTRUCTION" "$text" |
        timeout "$LLM_TIMEOUT_SECONDS" \
          env -u HERDR_ENV -u HERDR_TAB_ID -u HERDR_PANE_ID -u HERDR_SOCKET_PATH \
          codex exec --ephemeral --ignore-user-config --ignore-rules --disable hooks \
          --skip-git-repo-check --sandbox read-only --cd "${TMPDIR:-/tmp}" \
          --model "$CODEX_MODEL" -c 'model_reasoning_effort="none"' \
          -c 'web_search="disabled"' - 2>/dev/null) || {
        log_debug "refine: Codex model call failed for $session"
        return 0
      }
      ;;
    *)
      command -v claude >/dev/null 2>&1 || return 0
      # HERDR_* is scrubbed so this session's own hooks (this one and Herdr's
      # managed reporter) no-op instead of recursing or replacing the pane agent.
      raw=$(printf '%s\n\n---\n%s\n' "$LLM_INSTRUCTION" "$text" |
        timeout "$LLM_TIMEOUT_SECONDS" \
          env -u HERDR_ENV -u HERDR_TAB_ID -u HERDR_PANE_ID -u HERDR_SOCKET_PATH \
          claude -p --model "$CLAUDE_MODEL" --permission-mode plan \
          --settings "$LLM_SETTINGS" 2>/dev/null) || {
        log_debug "refine: Claude model call failed for $session"
        return 0
      }
      ;;
  esac

  local candidate=''
  local line
  while IFS= read -r line; do
    line=$(tidy_spaces "$line")
    [ -n "$line" ] || continue
    candidate=$line
    break
  done <<<"$raw"

  candidate=${candidate//[^a-zA-Z0-9 ._-]/}
  candidate=$(tidy_spaces "$candidate")
  candidate=$(strip_leading_hyphens "$candidate")
  [ -n "$candidate" ] || return 0

  # Truncating a model-written label mid-word reads worse than the fallback, so an
  # over-long or over-wordy answer is discarded rather than trimmed.
  [ "${#candidate}" -le "$LABEL_MAX_CHARS" ] || {
    log_debug "refine: discarded (too long) '$candidate'"
    return 0
  }
  local -a words=()
  read -ra words <<<"$candidate"
  [ "${#words[@]}" -le "$LLM_MAX_WORDS" ] || {
    log_debug "refine: discarded (too wordy) '$candidate'"
    return 0
  }

  # A /clear between spawn and now must win.
  local state_file stored=''
  state_file=$(state_file_for "$HERDR_TAB_ID")
  read -r stored 2>/dev/null <"$state_file" || true
  [ "$stored" = "$session" ] || {
    log_debug "refine: session moved on, skipping '$candidate'"
    return 0
  }

  rename_tab "$candidate"
  set_pane_title "$candidate"
  log_debug "refine: applied '$candidate'"
}

spawn_refine() {
  case "${HERDR_TABNAME_LLM:-claude}" in
    codex) command -v codex >/dev/null 2>&1 || return 0 ;;
    *) command -v claude >/dev/null 2>&1 || return 0 ;;
  esac
  command -v setsid >/dev/null 2>&1 || return 0
  setsid env HERDR_TABNAME_CHILD=1 bash "$SELF" --refine "$1" "$2" \
    </dev/null >/dev/null 2>&1 &
  disown 2>/dev/null || true
}

if [ "${1:-}" = '--refine' ]; then
  [ -n "${HERDR_TAB_ID:-}" ] || exit 0
  command -v herdr >/dev/null 2>&1 || exit 0
  refine_label "${2:-}" "${3:-}"
  exit 0
fi

# --- hook mode ---------------------------------------------------------------

[ -z "${HERDR_TABNAME_CHILD:-}" ] || exit 0
[ "${HERDR_ENV:-}" = '1' ] || exit 0
[ -n "${HERDR_TAB_ID:-}" ] || exit 0
command -v herdr >/dev/null 2>&1 || exit 0
command -v jq >/dev/null 2>&1 || exit 0

input=''
IFS= read -r -d '' input || true

# One jq pass for every field, including the already-flattened and truncated label:
# this is the only work on the steady-state path, which runs on every prompt.
fields=$(jq -r \
  --argjson labelMax "$LABEL_MAX_CHARS" \
  --argjson inputMax "$LLM_INPUT_MAX_CHARS" '
  def flat: (. // "") | gsub("[\n\r\t]"; " ") | gsub(" +"; " ")
    | sub("^ +"; "") | sub(" +$"; "");
  (.prompt | flat) as $prompt
  | [ (.hook_event_name // ""),
      (.session_id // ""),
      ($prompt[0:$labelMax] | sub(" +$"; "")),
      ($prompt[0:$inputMax]) ]
  | join("\u001f")
' <<<"$input" 2>/dev/null) || exit 0

event=''
session=''
label=''
llm_input=''
IFS=$'\037' read -r event session label llm_input <<<"$fields"
[ -n "$session" ] || session='unknown'

state_file=$(state_file_for "$HERDR_TAB_ID")

if [ "$event" = 'SessionStart' ]; then
  rm -f "$state_file"
  rename_tab "$RESET_LABEL"
  clear_pane_title
  exit 0
fi

[ "$event" = 'UserPromptSubmit' ] || exit 0

# The state file holds the session already named, so a stale file left in a reused
# tab cannot suppress naming, and /clear is handled whether or not it mints a new id.
stored=''
read -r stored 2>/dev/null <"$state_file" || true
[ "$stored" = "$session" ] && exit 0

label=$(strip_leading_hyphens "$label")
[ -n "$label" ] || exit 0

rename_tab "$label"
set_pane_title "$label"
printf '%s' "$session" >"$state_file" 2>/dev/null || true
spawn_refine "$session" "$llm_input"
exit 0
