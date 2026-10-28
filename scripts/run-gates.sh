#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  qa-services) [ $# -eq 1 ] || { echo 'usage: run-gates.sh qa-services' >&2; exit 2; }
    exec "$(dirname "$0")/../tests/backend-services.sh" ;;
  *) echo 'usage: run-gates.sh qa-services' >&2; exit 2 ;;
esac
