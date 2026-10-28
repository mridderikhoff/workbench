#!/usr/bin/env bash
# Isolated QA attachment exercise. All git trees and service calls stay in $S.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
S=$(mktemp -d)
trap 'rm -rf -- "$S"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }
check_log() {
  local expected="$1" actual
  actual=$(cat "$S/service.log" 2>/dev/null || true)
  [ "$actual" = "$expected" ] || fail "service calls: expected [$expected], got [$actual]"
}
status_branch() {
  "$ROOT/bin/wt" status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["backend"]["branch"])'
}
mkdir -p "$S/state" "$S/main" "$S/qa" "$S/bin"
git init -q --bare "$S/origin.git"
git init -q -b develop "$S/main"
git -C "$S/main" config user.name Fixture
git -C "$S/main" config user.email fixture@example.test
mkdir -p "$S/main/apps/backend"
printf '.wt-qa-runtime\n.port-offset\n' >"$S/main/.gitignore"
printf 'base\n' >"$S/main/apps/backend/server.py"
git -C "$S/main" add .
git -C "$S/main" commit -qm base
git -C "$S/main" remote add origin "$S/origin.git"
git -C "$S/main" push -q -u origin develop
git -C "$S/main" worktree add -q --detach "$S/qa" develop
touch "$S/qa/.wt-qa-runtime"
printf '1\n' >"$S/qa/.port-offset"
git -C "$S/main" checkout -qb feature
printf 'feature\n' >"$S/main/apps/backend/server.py"
git -C "$S/main" commit -qam feature
feature_head=$(git -C "$S/main" rev-parse HEAD)
git -C "$S/main" checkout -q develop
develop_head=$(git -C "$S/main" rev-parse HEAD)
cat >"$S/bin/qa-stack" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "$1" in
  foreign) [ ! -f "$FIXTURE/foreign" ] || { echo foreign-process; exit 0; } ;;
  restart|wait-probe|heal)
    printf '%s %s\n' "$1" "${2:-}" >>"$FIXTURE/service.log"
    [ ! -f "$FIXTURE/fail-$1-${2:-}" ] || exit 7 ;;
  health) printf '{"overall":"healthy","services":{}}\n' ;;
  *) echo "unexpected qa-stack command: $*" >&2; exit 8 ;;
esac
STUB
chmod +x "$S/bin/qa-stack"
export FIXTURE="$S" WT_MAIN_CHECKOUT="$S/main" WT_QA_TREE="$S/qa" QA_TREE="$S/qa"
export WT_STATE_DIR="$S/state" WT_QA_STACK_BIN="$S/bin/qa-stack" WT_BASE_BRANCH=develop
expected=$'restart functions\nwait-probe functions\nrestart langgraph\nwait-probe langgraph\nrestart backend\nwait-probe backend'

# Different SHA attachment must restart all application services and keep its name.
"$ROOT/bin/wt" qa feature >"$S/out" || fail 'feature attach failed'
[ "$(git -C "$S/qa" rev-parse HEAD)" = "$feature_head" ] || fail 'QA HEAD did not move'
check_log "$expected"
[ "$(status_branch)" = feature ] || fail 'status lost attached branch'
grep -q 'return to develop' "$S/out" || fail 'missing return guidance'

# Repeating the attachment still restarts, even though the HEAD is unchanged.
: >"$S/service.log"
"$ROOT/bin/wt" qa feature >"$S/out" || fail 'repeat attach failed'
check_log "$expected"

# A failed probe is nonzero and cannot claim a completed attachment.
: >"$S/service.log"
touch "$S/fail-wait-probe-langgraph"
if "$ROOT/bin/wt" qa feature >"$S/out" 2>&1; then fail 'probe failure returned success'; fi
[ "$(status_branch)" = None ] || fail 'failed attach claimed branch'
rm "$S/fail-wait-probe-langgraph"
"$ROOT/bin/wt" qa feature >"$S/out" || fail 'retry failed'
[ "$(status_branch)" = feature ] || fail 'retry did not complete attachment'

# Dry run does not move checkout, restart services, or write provenance.
: >"$S/service.log"
WT_DRY_RUN=1 "$ROOT/bin/wt" qa feature >"$S/out" || fail 'dry-run failed'
check_log ''
[ "$(status_branch)" = feature ] || fail 'dry-run changed provenance'

# A stale provenance path/HEAD cannot override the actual checkout. With no
# matching unique branch, status reports an unknown attachment.
git -C "$S/qa" checkout -q --detach "$develop_head"
[ "$(status_branch)" = develop ] || fail 'mismatched provenance blocked exact fallback'
git -C "$S/main" branch alias develop
[ "$(status_branch)" = None ] || fail 'ambiguous exact refs picked a branch'
git -C "$S/main" branch -D alias >/dev/null

# Successful return clears provenance. A backend-only source change restarts
# backend on return, exercising the generic apps/backend/* classifier.
"$ROOT/bin/wt" qa feature >"$S/out" || fail 'reattach failed'
: >"$S/service.log"
"$ROOT/bin/wt" backend update >"$S/out" || fail 'return to develop failed'
[ "$(git -C "$S/qa" rev-parse HEAD)" = "$develop_head" ] || fail 'return HEAD wrong'
check_log $'restart backend\nwait-probe backend\nheal '
[ "$(sed -n '3p' "$S/state/qa-attachment")" = develop ] || fail 'successful return kept feature provenance'
[ "$(status_branch)" = develop ] || fail 'returned status not develop'

# A failed return retains provenance so retry can finish the pending update.
"$ROOT/bin/wt" qa feature >"$S/out" || fail 'reattach failed'
touch "$S/fail-restart-backend"
if "$ROOT/bin/wt" backend update >"$S/out" 2>&1; then fail 'restart failure returned success'; fi
[ -f "$S/state/qa-attachment" ] || fail 'failed return erased provenance'
[ "$(status_branch)" = None ] || fail 'pending return claimed a serving branch'
rm "$S/fail-restart-backend"
"$ROOT/bin/wt" backend update >"$S/out" || fail 'return retry failed'
[ "$(sed -n '3p' "$S/state/qa-attachment")" = develop ] || fail 'return retry kept feature provenance'

# Same-SHA attachment to a distinct branch still needs a full service reset
# before backend update can report develop.
git -C "$S/main" branch same-head develop
"$ROOT/bin/wt" qa same-head >"$S/out" || fail 'same-head attach failed'
[ "$(status_branch)" = same-head ] || fail 'same-head provenance lost'
: >"$S/service.log"
"$ROOT/bin/wt" backend update >"$S/out" || fail 'same-head return failed'
check_log "$expected"$'\nheal '
[ "$(sed -n '3p' "$S/state/qa-attachment")" = develop ] || fail 'same-head return kept feature provenance'
[ "$(status_branch)" = develop ] || fail 'same-head return did not identify develop'
: >"$S/service.log"
"$ROOT/bin/wt" backend update >"$S/out" || fail 'repeat develop update failed'
check_log ''

# Before provenance existed, a detached checkout's latest HEAD reflog recorded
# the branch used. The branch may advance while QA remains at the old commit.
git -C "$S/qa" checkout -q --detach feature
rm "$S/state/qa-attachment"
git -C "$S/main" checkout -q feature
printf 'feature advanced\n' >"$S/main/apps/backend/server.py"
git -C "$S/main" commit -qam advance
git -C "$S/main" checkout -q develop
[ "$(git -C "$S/qa" rev-parse HEAD)" = "$feature_head" ] || fail 'legacy QA HEAD moved'
[ "$(status_branch)" = feature ] || fail 'reflog did not identify advanced feature ref'
git -C "$S/qa" checkout -q --detach "$develop_head"
git -C "$S/qa" checkout -q --detach "$feature_head"
[ "$(status_branch)" = None ] || fail 'raw hash checkout inferred a branch'

echo 'qa-attachment: all cases passed'
