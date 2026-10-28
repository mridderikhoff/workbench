#!/usr/bin/env bash
# Links the tools in this repository into the places Claude Code and the shell expect them, so edits
# made here are what actually runs. Existing files are moved aside as <name>.bak-<timestamp>.
# Usage: ./install.sh [--dry-run] [--runtime-only]
#   --runtime-only  link only bin/* into ~/.claude/bin (plus ~/.codex/bin/wt when ~/.codex exists);
#                   skip scripts/, hooks/ and every Codex hook file, including ~/.codex/hooks.json.
source "$(dirname "${BASH_SOURCE[0]}")/bin/overseer-env.sh" "$@"
set -euo pipefail

usage() { echo 'usage: ./install.sh [--dry-run] [--runtime-only]' >&2; exit 2; }

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# An explicit target root lets isolated previews avoid touching the user's home.
install_home="${OVERSEER_INSTALL_HOME:-$HOME}"
case "$install_home" in /*) ;; *) echo 'OVERSEER_INSTALL_HOME must be an absolute path' >&2; exit 2 ;; esac
if [ "$OVERSEER_MACOS" = 1 ]; then
  [ -x "$repo/bin/overseer-systemctl" ] && [ -x "$repo/bin/overseer-journalctl" ] || {
    echo 'Overseer Mac runtime adapters are missing or not executable; update this checkout first.' >&2; exit 1;
  }
  command -v launchctl >/dev/null 2>&1 || { echo 'Overseer needs macOS launchctl.' >&2; exit 1; }
fi
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

for file in "$repo"/bin/*; do link "$file" "$install_home/.claude/bin/$(basename "$file")"; done

if $runtime_only; then
  # A bare ~/.codex/bin/wt must never run a stale copy, but a machine without Codex should not grow ~/.codex.
  if [ -d "$install_home/.codex" ]; then
    link "$repo/bin/wt" "$install_home/.codex/bin/wt"
  else
    echo "skipped   $install_home/.codex/bin/wt (no ~/.codex directory)"
  fi
  echo "runtime-only: scripts/, hooks/ and Codex hook files were not touched"
  exit 0
fi

for file in "$repo"/scripts/*; do link "$file" "$install_home/.claude/scripts/$(basename "$file")"; done
for file in "$repo"/hooks/*; do link "$file" "$install_home/.claude/hooks/$(basename "$file")"; done
# Codex loads its own hook set; ~/.codex/bin/wt is kept as a link so a bare path never runs a stale copy.
for file in "$repo"/codex/hooks/*; do link "$file" "$install_home/.codex/hooks/$(basename "$file")"; done
link "$repo/codex/hooks.json" "$install_home/.codex/hooks.json"
link "$repo/codex/herdr-agent-state.sh" "$install_home/.codex/herdr-agent-state.sh"
link "$repo/bin/wt" "$install_home/.codex/bin/wt"
