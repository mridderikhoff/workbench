#!/usr/bin/env bash
# Shared environment for CLI entrypoints and launchd jobs.
if [ "$(uname -s)" = Darwin ]; then
  for overseer_prefix in /opt/homebrew /usr/local; do
    [ -d "$overseer_prefix/bin" ] && PATH="$overseer_prefix/bin:$PATH"
    [ -d "$overseer_prefix/opt/coreutils/libexec/gnubin" ] && PATH="$overseer_prefix/opt/coreutils/libexec/gnubin:$PATH"
  done
  export PATH
  if [ "${BASH_VERSINFO[0]:-0}" -lt 4 ] || { [ "${BASH_VERSINFO[0]:-0}" -eq 4 ] && [ "${BASH_VERSINFO[1]:-0}" -lt 4 ]; }; then
    for overseer_bash in /opt/homebrew/bin/bash /usr/local/bin/bash; do
      if [ -x "$overseer_bash" ]; then exec "$overseer_bash" "$0" "$@"; fi
    done
    echo 'Overseer needs Bash 4.4 or newer. Install: brew install bash coreutils flock python@3.13' >&2
    exit 1
  fi
  for overseer_tool in python3 flock timeout realpath readlink sha256sum; do
    command -v "$overseer_tool" >/dev/null 2>&1 || {
      echo "Overseer needs $overseer_tool. Install: brew install bash coreutils flock python@3.13" >&2; exit 1;
    }
  done
fi
OVERSEER_BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
export OVERSEER_BIN_DIR
if [ -f "$HOME/.config/overseer/runtime.env" ]; then
  overseer_saved_env=()
  for overseer_name in WT_MAIN_CHECKOUT QA_TREE WT_QA_TREE WT_TENANT KC_LIB QA_UNIT_DIR WT_STATE_DIR; do
    if declare -p "$overseer_name" >/dev/null 2>&1; then
      overseer_saved_env+=("$(declare -p "$overseer_name")")
    fi
  done
  set -a
  . "$HOME/.config/overseer/runtime.env"
  set +a
  for overseer_assignment in "${overseer_saved_env[@]}"; do eval "$overseer_assignment"; done
fi
if [ "$(uname -s)" = Darwin ]; then
  export OVERSEER_SYSTEMCTL="$OVERSEER_BIN_DIR/overseer-systemctl"
  export OVERSEER_JOURNALCTL="$OVERSEER_BIN_DIR/overseer-journalctl"
  export OVERSEER_MACOS=1
else
  export OVERSEER_SYSTEMCTL=systemctl OVERSEER_JOURNALCTL=journalctl OVERSEER_MACOS=0
fi
