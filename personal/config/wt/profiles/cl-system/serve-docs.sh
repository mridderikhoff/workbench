#!/usr/bin/env bash
set -euo pipefail

port=5200
case "${1:-}" in
  "") ;;
  --port)
    [[ $# == 2 ]] || { echo 'Usage: serve-docs.sh [--port N]' >&2; exit 2; }
    port="$2"
    ;;
  --port=*)
    [[ $# == 1 ]] || { echo 'Usage: serve-docs.sh [--port N]' >&2; exit 2; }
    port="${1#--port=}"
    ;;
  *) echo 'Usage: serve-docs.sh [--port N]' >&2; exit 2 ;;
esac
[[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1 && port <= 65535 )) || { echo "Invalid port: $port" >&2; exit 2; }

source "$(dirname "${BASH_SOURCE[0]}")/nx-env.sh"
cd "$wt_root"

if ! node build_scripts/check_docs_initialized.mjs; then
  echo 'Docs artifacts are missing; building modules and initializing Docs.' >&2
  bash build_scripts/build_modules.sh
  pnpm init:docs
  if ! node build_scripts/check_docs_initialized.mjs; then
    exit 2
  fi
fi

public_host_args=()
if [[ -n "${WT_SERVE_PUBLIC_HOST:-}" ]]; then
  public_host_args=("--publicHost=$WT_SERVE_PUBLIC_HOST")
fi

export NODE_OPTIONS="--max-old-space-size=4096"
exec pnpm exec nx serve system-docs "--port=$port" "${public_host_args[@]}"
