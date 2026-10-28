#!/usr/bin/env bash
# Links the tools in this repository into the places Claude Code and the shell expect them, so edits
# made here are what actually runs. Existing files are moved aside as <name>.bak-<timestamp>.
# Usage: ./install.sh [--dry-run] [--runtime-only]
#   --runtime-only  link only bin/* into ~/.claude/bin (plus ~/.codex/bin/wt when ~/.codex exists);
#                   skip scripts/, hooks/ and every Codex hook file, including ~/.codex/hooks.json.
set -euo pipefail

usage() { echo 'usage: ./install.sh [--dry-run] [--runtime-only]' >&2; exit 2; }

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dry_run=false
runtime_only=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    --runtime-only) runtime_only=true ;;
    *) usage ;;
  esac
done
stamp="$(date +%Y%m%d-%H%M%S)"

link() {
  local source="$1" target="$2"
  if [ -L "$target" ] && [ "$(readlink -f "$target")" = "$source" ]; then
    echo "ok        $target"
    return
  fi
  if $dry_run; then
    [ -e "$target" ] && echo "would back up $target -> $target.bak-$stamp"
    echo "would link $target -> $source"
    return
  fi
  mkdir -p "$(dirname "$target")"
  if [ -e "$target" ] || [ -L "$target" ]; then mv "$target" "$target.bak-$stamp"; fi
  ln -s "$source" "$target"
  echo "linked    $target -> $source"
}

for file in "$repo"/bin/*; do link "$file" "$HOME/.claude/bin/$(basename "$file")"; done

if $runtime_only; then
  # A bare ~/.codex/bin/wt must never run a stale copy, but a machine without Codex should not grow ~/.codex.
  if [ -d "$HOME/.codex" ]; then
    link "$repo/bin/wt" "$HOME/.codex/bin/wt"
  else
    echo "skipped   $HOME/.codex/bin/wt (no ~/.codex directory)"
  fi
  echo "runtime-only: scripts/, hooks/ and Codex hook files were not touched"
  exit 0
fi

for file in "$repo"/scripts/*; do link "$file" "$HOME/.claude/scripts/$(basename "$file")"; done
for file in "$repo"/hooks/*; do link "$file" "$HOME/.claude/hooks/$(basename "$file")"; done
# Codex loads its own hook set; ~/.codex/bin/wt is kept as a link so a bare path never runs a stale copy.
for file in "$repo"/codex/hooks/*; do link "$file" "$HOME/.codex/hooks/$(basename "$file")"; done
link "$repo/codex/hooks.json" "$HOME/.codex/hooks.json"
link "$repo/codex/herdr-agent-state.sh" "$HOME/.codex/herdr-agent-state.sh"
link "$repo/bin/wt" "$HOME/.codex/bin/wt"
