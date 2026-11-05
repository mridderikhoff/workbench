#!/usr/bin/env bash
# Links the tools in this repository into the places Claude Code and the shell expect them, so edits
# made here are what actually runs. Existing files are moved aside as <name>.bak-<timestamp>.
# Usage: ./install.sh [--dry-run] [--personal|--runtime-only]
# Default / --runtime-only: runtime bin links only.
# --personal: additionally install the author's prompts, skills, hooks and portable preferences.
source "$(dirname "${BASH_SOURCE[0]}")/bin/overseer-env.sh" "$@"
set -euo pipefail

usage() { echo 'usage: ./install.sh [--dry-run] [--personal|--runtime-only]' >&2; exit 2; }

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
personal=false
runtime_only=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=true ;;
    --runtime-only) runtime_only=true ;;
    --personal) personal=true ;;
    *) usage ;;
  esac
done
if $personal && $runtime_only; then usage; fi
stamp="$(date +%Y%m%d-%H%M%S)-$$"

link() {
  local source="$1" target="$2" backup suffix
  if [ -L "$target" ] && [ "$(readlink -f "$target")" = "$source" ]; then
    echo "ok        $target"
    return
  fi
  if $dry_run; then
    if [ -e "$target" ] || [ -L "$target" ]; then echo "would back up $target -> $target.bak-$stamp"; fi
    echo "would link $target -> $source"
    return
  fi
  mkdir -p "$(dirname "$target")"
  if [ -e "$target" ] || [ -L "$target" ]; then
    backup="$target.bak-$stamp"
    suffix=0
    while [ -e "$backup" ] || [ -L "$backup" ]; do
      suffix=$((suffix + 1)); backup="$target.bak-$stamp-$suffix"
    done
    mv "$target" "$backup"
  fi
  ln -s "$source" "$target"
  echo "linked    $target -> $source"
}

for file in "$repo"/bin/*; do link "$file" "$install_home/.claude/bin/$(basename "$file")"; done

# A bare ~/.codex/bin/wt must never run a stale copy.
if $personal || [ -d "$install_home/.codex" ]; then
  link "$repo/bin/wt" "$install_home/.codex/bin/wt"
else
  echo "skipped   $install_home/.codex/bin/wt (no ~/.codex directory)"
fi

if ! $personal; then
  echo "runtime-only: personal prompts, skills, settings and hooks were not touched"
  exit 0
fi

personal_args=(--home "$install_home")
if $dry_run; then personal_args+=(--dry-run); fi
python3 "$repo/personal/install.py" "${personal_args[@]}"
