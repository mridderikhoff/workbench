#!/usr/bin/env bash
# Isolated T3 and wt state fixture; no services are contacted.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
SCRATCH=${WT_TEST_SCRATCH:-${TMPDIR:-/tmp}}
S=$(mktemp -d "$SCRATCH/wt-stop-stale.XXXXXX")
trap 'rm -rf -- "$S"' EXIT
mkdir -p "$S/state/wt-serve" "$S/units" "$S/old" "$S/old2" "$S/live" "$S/untouched" "$S/qa"
export T3_STATE_DB="$S/state.sqlite" WT_STATE_DIR="$S/state" WT_DRY_RUN=1
export WT_MAIN_CHECKOUT="$ROOT" QA_UNIT_DIR="$S/units" TMPDIR="$S" WT_QA_TREE="$S/qa" QA_TREE="$S/qa" WT_STUB_PORTS=' ' PYTHONPYCACHEPREFIX="$S/pycache"
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
import json, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute('CREATE TABLE orchestration_v2_projection_threads (thread_id TEXT, project_id TEXT, title TEXT, archived_at TEXT, deleted_at TEXT, payload_json TEXT)')
db.execute('CREATE TABLE projection_threads (thread_id TEXT, worktree_path TEXT, title TEXT, latest_user_message_at TEXT, updated_at TEXT, created_at TEXT, deleted_at TEXT, archived_at TEXT, settled_at TEXT, unsettled_at TEXT)')
base = sys.argv[2]
rows = [
    ('old', base + '/old', {'settledAt': '2026-11-01', 'updatedAt': '2026-11-02'}, None, None),
    ('old-archived', base + '/old/../old', {'archivedAt': '2026-11-03'}, None, None),
    ('old2', base + '/old2', {'settledAt': None}, None, '2026-11-03'),
    ('live', base + '/live', {'settledAt': '2026-11-01', 'settledOverride': 'active', 'lastVisitedAt': '2026-11-04'}, None, None),
    ('live-settled', base + '/live', {'settledAt': '2026-11-05'}, None, None),
]
db.executemany('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?, ?, ?)',
               [(tid, 'project', tid, archived, deleted, json.dumps(dict(payload, worktreePath=path)))
                for tid, path, payload, archived, deleted in rows])
# This frozen legacy table must not override the v2 projection.
db.execute('INSERT INTO projection_threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
           ('frozen', base + '/old', 'frozen', None, None, None, None, None, None, None))
db.commit()
PY
for entry in '2 old' '3 live' '4 untouched' '5 old2'; do
  read -r slot branch <<<"$entry"
  repo=cl-strategy
  [ "$branch" = old2 ] && repo=cl-system
  printf 'branch=%s\npath=%s\nrepo=%s\napps=ds-demo\nunits=ds-demo\nkc=\n' \
    "$branch" "$S/$branch" "$repo" >"$WT_STATE_DIR/wt-serve/slot-$slot"
done
"$ROOT/bin/t3-thread" worktrees --json >"$S/worktrees.json"
python3 - "$S/worktrees.json" "$S" <<'PY'
import json, sys
items = {item['path']: item['state'] for item in json.load(open(sys.argv[1]))['worktrees']}
assert items == {sys.argv[2] + '/old': 'settled', sys.argv[2] + '/old2': 'settled',
                 sys.argv[2] + '/live': 'live'}, items
PY
"$ROOT/bin/t3-thread" self --cwd "$S/live" >"$S/self.txt"
grep -qx live "$S/self.txt"
python3 - "$S/legacy.sqlite" "$S" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute('CREATE TABLE projection_threads (thread_id TEXT, worktree_path TEXT, title TEXT, latest_user_message_at TEXT, updated_at TEXT, created_at TEXT, deleted_at TEXT, archived_at TEXT, settled_at TEXT, unsettled_at TEXT)')
db.executemany('INSERT INTO projection_threads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
    ('legacy-live', sys.argv[2] + '/live', 'live', None, '2026-10-01', None, None, None, None, None),
    ('legacy-old', sys.argv[2] + '/old', 'old', None, '2026-10-01', None, None, None, '2026-10-02', None),
])
db.commit()
PY
T3_STATE_DB="$S/legacy.sqlite" "$ROOT/bin/t3-thread" worktrees --json >"$S/legacy-worktrees.json"
python3 - "$S/legacy-worktrees.json" "$S" <<'PY'
import json, sys
items = {item['path']: item['state'] for item in json.load(open(sys.argv[1]))['worktrees']}
assert items == {sys.argv[2] + '/old': 'settled', sys.argv[2] + '/live': 'live'}, items
PY
T3_STATE_DB="$S/legacy.sqlite" "$ROOT/bin/t3-thread" self --cwd "$S/live" >"$S/legacy-self.txt"
grep -qx legacy-live "$S/legacy-self.txt"
mkdir -p "$S/home/.t3/userdata"
cp "$S/legacy.sqlite" "$S/home/.t3/userdata/state.sqlite"
python3 - "$S/home/.t3/userdata/statev2.sqlite" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute('CREATE TABLE projection_threads (thread_id TEXT)')
db.commit()
PY
env -u T3_STATE_DB HOME="$S/home" "$ROOT/bin/t3-thread" worktrees --json >"$S/fallback-worktrees.json"
cmp "$S/legacy-worktrees.json" "$S/fallback-worktrees.json"
T3_STATE_DB="$S/legacy.sqlite" "$ROOT/bin/wt" status --json >"$S/legacy-status.json"
python3 - "$S/legacy-status.json" <<'PY'
import json, sys
slots = {slot['branch']: slot['stale'] for slot in json.load(open(sys.argv[1]))['slots']}
assert slots == {'old': True, 'old2': False, 'live': False, 'untouched': False}, slots
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
"$ROOT/bin/wt" serve --stop-stale --repo cl-system --dry-run >"$S/repo-dry-run.txt"
grep -qx 'stale      slot 5 old2' "$S/repo-dry-run.txt"
[ "$(wc -l <"$S/repo-dry-run.txt")" -eq 1 ]
"$ROOT/bin/wt" serve --stop-stale --repo cl-system --only-slot 5 old2 "$S/old2" --dry-run >"$S/approved-dry-run.txt"
grep -qx 'stale      slot 5 old2' "$S/approved-dry-run.txt"
"$ROOT/bin/wt" serve --stop-stale --repo cl-system --only-slot 5 wrong "$S/old2" --dry-run >"$S/mismatch.txt"
grep -qx 'no stale slots' "$S/mismatch.txt"
"$ROOT/bin/wt" serve --stop old old2 missing >"$S/stop.txt" 2>"$S/stop.err" && exit 1
grep -qx 'slot       2 stopped for old' "$S/stop.txt"
grep -qx 'slot       5 stopped for old2' "$S/stop.txt"
grep -qx 'serve      no slot for missing' "$S/stop.err"
[ ! -e "$WT_STATE_DIR/wt-serve/slot-2" ]
[ ! -e "$WT_STATE_DIR/wt-serve/slot-5" ]
[ -e "$WT_STATE_DIR/wt-serve/slot-3" ]
printf 'branch=old\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/old" >"$WT_STATE_DIR/wt-serve/slot-2"
printf 'branch=old2\npath=%s\nrepo=cl-system\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/old2" >"$WT_STATE_DIR/wt-serve/slot-5"
printf 'branch=old\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/live" >"$WT_STATE_DIR/wt-serve/slot-6"
mkdir -p "$S/late"
python3 - "$T3_STATE_DB" "$S/late" <<'PY'
import json, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
db.execute('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?, ?, ?)',
           ('late', 'project', 'late', None, None, json.dumps({'worktreePath': sys.argv[2], 'settledAt': '2026-11-06'})))
db.commit()
PY
printf 'branch=late\npath=%s\nrepo=cl-system\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/late" >"$WT_STATE_DIR/wt-serve/slot-7"
"$ROOT/bin/wt" serve --stop-stale --repo cl-system --only-slot 5 old2 "$S/old2" >"$S/system-stop.txt"
grep -qx 'slot       5 stopped for old2' "$S/system-stop.txt"
[ -e "$WT_STATE_DIR/wt-serve/slot-2" ] && [ ! -e "$WT_STATE_DIR/wt-serve/slot-5" ] && [ -e "$WT_STATE_DIR/wt-serve/slot-7" ]
"$ROOT/bin/wt" serve --stop-stale --repo cl-strategy --only-slot 2 old "$S/old" >"$S/stale-stop.txt"
grep -qx 'slot       2 stopped for old' "$S/stale-stop.txt"
[ ! -e "$WT_STATE_DIR/wt-serve/slot-2" ] && [ ! -e "$WT_STATE_DIR/wt-serve/slot-5" ]
[ -e "$WT_STATE_DIR/wt-serve/slot-6" ]
[ -e "$WT_STATE_DIR/wt-serve/slot-7" ]
mkdir -p "$S/main/.git"
python3 - "$T3_STATE_DB" "$S/main" "$S/missing" <<'PY'
import json, sqlite3, sys
db = sqlite3.connect(sys.argv[1])
for name, path in [('main', sys.argv[2]), ('missing', sys.argv[3])]:
    db.execute('INSERT INTO orchestration_v2_projection_threads VALUES (?, ?, ?, ?, ?, ?)',
               (name, 'project', name, None, None, json.dumps({'worktreePath': path, 'settledAt': '2026-11-07'})))
db.commit()
PY
printf 'branch=main\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/main" >"$WT_STATE_DIR/wt-serve/slot-2"
printf 'branch=missing\npath=%s\nrepo=cl-strategy\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/missing" >"$WT_STATE_DIR/wt-serve/slot-5"
printf 'branch=old\npath=%s\napps=ds-demo\nunits=ds-demo\nkc=\n' "$S/old" >"$WT_STATE_DIR/wt-serve/slot-8"
"$ROOT/bin/wt" status --json >"$S/exclusions.json"
python3 - "$S/exclusions.json" <<'PY'
import json, sys
slots = {slot['branch']: slot for slot in json.load(open(sys.argv[1]))['slots']}
assert slots['main']['stale'] is False and slots['missing']['stale'] is False, slots
assert slots['old']['stale'] is True and slots['old']['repo'] == 'cl-strategy', slots
PY
"$ROOT/bin/wt" serve --stop-stale --repo cl-strategy --dry-run >"$S/exclusions-dry-run.txt"
grep -qx 'stale      slot 8 old' "$S/exclusions-dry-run.txt"
[ "$(wc -l <"$S/exclusions-dry-run.txt")" -eq 1 ]
T3_STATE_DB="$S/missing.sqlite" "$ROOT/bin/wt" serve --stop-stale --dry-run >"$S/missing.txt" 2>"$S/missing.err"
grep -qx 'no stale slots' "$S/missing.txt"
grep -q 'warning: cannot read' "$S/missing.err"
echo 'ok wt stop stale fixture'
