#!/usr/bin/env bash
# UserPromptSubmit: record whether THIS user message asks to attach QA to a branch.
#
# Writes a one-turn marker when the message reads as a QA-attach request, and clears
# it otherwise. The companion PreToolUse guard (wt-qa-guard.sh) allows `wt qa <branch>`
# only while the marker exists, so an attach can only happen on a turn the user asked
# for it — with no confirmation prompt on the path the user does want.
set -u

marker="$HOME/.claude/.wt-qa-attach-intent"
input="$(cat)"
prompt="$(printf '%s' "$input" | jq -r '.prompt // ""')"

# Low-friction intent match: any mention of QA, or an attach/serve/point verb. Fails
# open on phrasing it recognizes (marker set) and closed on everything else (marker
# cleared), so a normal coding turn that never mentions QA can't authorize an attach.
if printf '%s' "$prompt" | grep -Eiq '\bqa\b|attach|(point|switch|serve).*(qa|branch)'; then
  : > "$marker"
else
  rm -f "$marker"
fi
exit 0
