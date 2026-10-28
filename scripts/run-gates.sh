#!/usr/bin/env bash
set -euo pipefail
case "${1:-}" in
  qa-services) [ $# -eq 1 ] || { echo 'usage: run-gates.sh qa-services|qa-dashboard' >&2; exit 2; }
    exec "$(dirname "$0")/../tests/backend-services.sh" ;;
  qa-dashboard) [ $# -eq 1 ] || { echo 'usage: run-gates.sh qa-services|qa-dashboard' >&2; exit 2; }
    python3 "$(dirname "$0")/../tests/dashboard-actions.py"
    exec node "$(dirname "$0")/../tests/dashboard-recovery.js" ;;
  qa-attachment) [ $# -eq 1 ] || { echo 'usage: run-gates.sh qa-attachment' >&2; exit 2; }
    exec "$(dirname "$0")/../tests/wt-qa-attachment.sh" ;;
  macos-runtime) [ $# -eq 1 ] || { echo 'usage: run-gates.sh macos-runtime' >&2; exit 2; }
    python3 "$(dirname "$0")/../tests/platform_macos.py"
    exec bash "$(dirname "$0")/../tests/macos-integration.sh" ;;
  *) echo 'usage: run-gates.sh qa-services|qa-dashboard|qa-attachment|macos-runtime' >&2; exit 2 ;;
esac
