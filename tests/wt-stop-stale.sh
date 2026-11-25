#!/usr/bin/env bash
# Isolated T3 and wt state fixture; no services are contacted.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCRATCH=/tmp/codex-stop-stale-slots.rfz4Cj
S=$(mktemp -d "$SCRATCH/wt-stop-stale.XXXXXX")
trap 'rm -rf -- "$S"' EXIT
mkdir -p "$S/state/wt-serve" "$S/units" "$S/old" "$S/old2" "$S/live" "$S/untouched" "$S/qa"
export T3_STATE_DB="$S/state.sqlite" WT_STATE_DIR="$S/state" WT_DRY_RUN=1
export WT_MAIN_CHECKOUT="$ROOT" QA_UNIT_DIR="$S/units" TMPDIR="$S" WT_QA_TREE="$S/qa" QA_TREE="$S/qa" WT_STUB_PORTS=' '
cat >"$S/qa-stack" <<'STUB'
#!/usr/bin/env bash
printf '{"overall":"unknown","services":{}}\n'
STUB
cat >"$S/systemctl" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
chmod +x "$S/qa-stack" "$S/systemctl"
export WT_QA_STACK_BIN="$S/qa-stack" OVERSEER_SYSTEMCTL="$S/systemctl"
python3 - "$T3_STATE_DB" "$S" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute('CREATE TABLE projection_threads (worktree_path TEXT, deleted_at TEXT, archived_at TEXT, settled_at TEXT, unsettled_at TEXT)')
base = sys.argv[2]
db.executemany('INSERT INTO projection_threads VALUES (?, ?, ?, ?, ?)', [
    (base + '/old', None, None, '2026-01-01', None),
    (base + '/old/../old', None, '2026-01-02', None, None),
    (base + '/old2', '2026-01-03', None, None, None),
    (base + '/live', None, None, None, None),
    (base + '/live', None, None, '2026-01-01', None),
])
db.commit()
PY
for entry in '2 old' '3 live' '4 untouched' '5 old2'; do
  read -r slot branch <<<"$entry"
  printf 'branch=%s\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' \
    "$branch" "$S/$branch" >"$WT_STATE_DIR/wt-serve/slot-$slot"
done
"$ROOT/bin/t3-thread" worktrees --json >"$S/worktrees.json"
python3 - "$S/worktrees.json" "$S" <<'PY'
import json, sys
items = {item['path']: item['state'] for item in json.load(open(sys.argv[1]))['worktrees']}
assert items == {sys.argv[2] + '/old': 'settled', sys.argv[2] + '/old2': 'settled',
                 sys.argv[2] + '/live': 'live'}, items
PY
"$ROOT/bin/wt" status --json >"$S/status.json"
python3 - "$S/status.json" <<'PY'
import json, sys
slots = {slot['branch']: slot['stale'] for slot in json.load(open(sys.argv[1]))['slots']}
assert slots == {'old': True, 'old2': True, 'live': False, 'untouched': False}, slots
PY
"$ROOT/bin/wt" serve --stop-stale --dry-run >"$S/dry-run.txt"
grep -qx 'stale      slot 2 old' "$S/dry-run.txt"
grep -qx 'stale      slot 5 old2' "$S/dry-run.txt"
[ "$(wc -l <"$S/dry-run.txt")" -eq 2 ]
"$ROOT/bin/wt" serve --stop old old2 missing >"$S/stop.txt" 2>"$S/stop.err" && exit 1
grep -qx 'slot       2 stopped for old' "$S/stop.txt"
grep -qx 'slot       5 stopped for old2' "$S/stop.txt"
grep -qx 'serve      no slot for missing' "$S/stop.err"
[ ! -e "$WT_STATE_DIR/wt-serve/slot-2" ]
[ ! -e "$WT_STATE_DIR/wt-serve/slot-5" ]
[ -e "$WT_STATE_DIR/wt-serve/slot-3" ]
printf 'branch=old\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/old" >"$WT_STATE_DIR/wt-serve/slot-2"
printf 'branch=old2\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/old2" >"$WT_STATE_DIR/wt-serve/slot-5"
printf 'branch=old\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/live" >"$WT_STATE_DIR/wt-serve/slot-6"
"$ROOT/bin/wt" serve --stop-stale >"$S/stale-stop.txt"
grep -qx 'slot       2 stopped for old' "$S/stale-stop.txt"
grep -qx 'slot       5 stopped for old2' "$S/stale-stop.txt"
[ ! -e "$WT_STATE_DIR/wt-serve/slot-2" ] && [ ! -e "$WT_STATE_DIR/wt-serve/slot-5" ]
[ -e "$WT_STATE_DIR/wt-serve/slot-6" ]
T3_STATE_DB="$S/missing.sqlite" "$ROOT/bin/wt" serve --stop-stale --dry-run >"$S/missing.txt" 2>"$S/missing.err"
grep -qx 'no stale slots' "$S/missing.txt"
grep -q 'warning: cannot read' "$S/missing.err"
echo 'ok wt stop stale fixture'
