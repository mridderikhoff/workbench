#!/usr/bin/env bash

# These exports intentionally configure Nx and Chrome for the sourcing caller.
if [[ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" != true ]] ||
  ! wt_root="$(git rev-parse --show-toplevel 2>/dev/null)" ||
  ! wt_git_dir="$(git rev-parse --path-format=absolute --git-dir 2>/dev/null)" ||
  ! wt_common_dir="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
  printf 'wt Nx environment: current directory is not inside a Git worktree\n' >&2
  return 1
fi
wt_cache_choice="local"

if [[ "${WT_NX_SHARED_CACHE:-}" != 0 && -z "${NX_CACHE_DIRECTORY:-}" ]] &&
  { [[ "$wt_git_dir" != "$wt_common_dir" ]] || [[ "${WT_NX_SHARED_CACHE:-}" == 1 ]]; }; then
  if [[ -z "${HOME:-}" ]]; then
    printf 'wt Nx environment: HOME is required for the shared cache\n' >&2
    return 1
  fi
  wt_cache_key="$(basename "$(dirname "$wt_common_dir")")"
  export NX_CACHE_DIRECTORY="$HOME/.cache/wt-nx/$wt_cache_key/cache"
  export NX_WORKSPACE_DATA_DIRECTORY="$HOME/.cache/wt-nx/$wt_cache_key/data"
  wt_cache_choice="shared ($wt_cache_key)"
elif [[ -n "${NX_CACHE_DIRECTORY:-}" ]]; then
  wt_cache_choice="provided ($NX_CACHE_DIRECTORY)"
fi

export NX_DAEMON=false

if [[ -z "${CHROME_BIN:-}" ]] && ! command -v google-chrome >/dev/null 2>&1 &&
  ! command -v chromium >/dev/null 2>&1 && [[ -n "${HOME:-}" ]]; then
  wt_chrome="$(find "$HOME/.cache/ms-playwright" -path '*/chrome-linux*/chrome' -type f 2>/dev/null | sort -V | tail -n 1 || true)"
  if [[ -n "$wt_chrome" ]]; then
    export CHROME_BIN="$wt_chrome"
  fi
fi

printf 'wt Nx environment: cache=%s; Chrome=%s; daemon=off\n' "$wt_cache_choice" "${CHROME_BIN:-PATH or unavailable}" >&2
