#!/usr/bin/env bash
# Isolated Mac command routing and installer preview; never calls real launchctl.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd -P)
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$scratch/bin" "$scratch/home/.config/overseer" "$scratch/home/.claude/bin"
cat >"$scratch/bin/uname" <<'EOF'
#!/usr/bin/env sh
echo Darwin
EOF
cat >"$scratch/bin/launchctl" <<'EOF'
#!/usr/bin/env sh
echo 'launchctl must not run in a dry-run' >&2
exit 99
EOF
chmod +x "$scratch/bin/uname" "$scratch/bin/launchctl"
cat >"$scratch/home/.config/overseer/runtime.env" <<EOF
WT_MAIN_CHECKOUT="$scratch/home/check out"
WT_TENANT="designer"
EOF
touch "$scratch/home/.claude/bin/wt"
before=$(stat -c %Y "$scratch/home/.claude/bin/wt")
HOME="$scratch/home" PATH="$scratch/bin:$PATH" "$repo/install.sh" --runtime-only --dry-run >"$scratch/preview"
grep -q 'would back up' "$scratch/preview"
grep -q 'would link' "$scratch/preview"
test "$before" = "$(stat -c %Y "$scratch/home/.claude/bin/wt")"
test ! -L "$scratch/home/.claude/bin/wt"
HOME="$scratch/home" PATH="$scratch/bin:$PATH" bash -c '
  source "$1/bin/overseer-env.sh"
  test "$OVERSEER_MACOS" = 1
  test "$OVERSEER_SYSTEMCTL" = "$1/bin/overseer-systemctl"
  test "$OVERSEER_JOURNALCTL" = "$1/bin/overseer-journalctl"
  test "$WT_MAIN_CHECKOUT" = "$HOME/check out"
' _ "$repo"
echo 'macos integration smoke: ok'
