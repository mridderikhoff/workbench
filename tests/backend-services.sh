#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
ORIGINAL_HOME=$HOME
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
mkdir -p "$S"/{bin,qa,state,unitdir,stub/proc,units,on,main,net}
touch "$S/qa/.wt-qa-runtime"
printf '1\n' > "$S/qa/.port-offset"
printf '#!/usr/bin/env bash\necho "$*" >> "$FIXTURE/devstart.log"\n' > "$S/qa/dev-start.sh"
chmod +x "$S/qa/dev-start.sh"
cat > "$S/bin/systemctl" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
[[ "$1" == --user ]] || { echo UNEXPECTED >> "$FIXTURE/unexpected"; exit 97; }
shift
action=$1; shift
case "$action" in
  show)
    unit=$1
    echo "$unit" >> "$FIXTURE/show.log"
    [ ! -e "$FIXTURE/units/$unit.fail" ] || exit 1
    [ ! -e "$FIXTURE/on/tick" ] || "$FIXTURE/on/tick" "$unit"
    cat "$FIXTURE/units/$unit"
    ;;
  reset-failed|start|restart)
    echo "$action $*" >> "$FIXTURE/mutations.log"
    unit=${!#}
    [ ! -x "$FIXTURE/on/$action-$unit" ] || "$FIXTURE/on/$action-$unit"
    ;;
  is-active)
    unit=$1
    sed -n 's/^ActiveState=//p' "$FIXTURE/units/$unit" ;;
  *) echo UNEXPECTED >> "$FIXTURE/unexpected"; exit 97 ;;
esac
SH
cat > "$S/bin/journalctl" <<'SH'
#!/usr/bin/env bash
echo "$*" >> "$FIXTURE/journal.log"
echo 'fixture journal line' >&2
SH
for tool in podman curl herdr; do
  printf '#!/usr/bin/env bash\necho UNEXPECTED >> "$FIXTURE/unexpected"\nexit 97\n' > "$S/bin/$tool"
done
chmod +x "$S/bin/"*
export FIXTURE="$S" PATH="$S/bin:$PATH" WT_STATE_DIR="$S/state" QA_UNIT_DIR="$S/unitdir" QA_TREE="$S/qa" WT_QA_TREE="$S/qa"
export WT_PORT_REGISTRY="$S/registry.json" QA_UNIT_PREFIX=wtfixture-qa- QA_STACK_STUB_DIR="$S/stub" QA_STACK_PROC_NET_DIR="$S/net"
export WT_ENSURE_TIMEOUT=12 WT_MAIN_CHECKOUT="$S/main" WT_BOOT_ID=fixture WT_BOOT_TIME=0
[ "$HOME" = "$ORIGINAL_HOME" ]
for tool in systemctl journalctl podman curl; do [[ $(command -v "$tool") == "$S/bin/$tool" ]]; done
for key in WT_STATE_DIR QA_UNIT_DIR QA_TREE WT_QA_TREE WT_PORT_REGISTRY QA_STACK_STUB_DIR QA_STACK_PROC_NET_DIR; do [[ ${!key} == "$S"/* ]]; done
[[ "$QA_UNIT_PREFIX" == wtfixture-* ]]
count=0
fail() { echo "FAIL case $count: $*" >&2; exit 1; }
run() {
  local expected=$1 actual; shift
  : > "$S/out"; : > "$S/err"
  actual=0; "$@" >"$S/out" 2>"$S/err" || actual=$?
  [ "$actual" -eq "$expected" ] || { cat "$S/out" "$S/err" >&2; fail "expected $expected got $actual: $*"; }
  [ ! -e "$S/unexpected" ] || fail 'unexpected external call'
  count=$((count+1))
}
unit_file() {
  cat > "$S/units/wtfixture-qa-$1.service" <<EOF
LoadState=loaded
ActiveState=$2
SubState=$3
UnitFileState=disabled
Type=$4
Result=success
MainPID=$5
NRestarts=0
ExecMainCode=1
ExecMainStatus=0
ExecMainStartTimestamp=0
ExecMainExitTimestamp=0
ActiveEnterTimestamp=0
InactiveEnterTimestamp=0
WorkingDirectory=$S/qa
EOF
}
reset() {
  : > "$S/mutations.log"; : > "$S/journal.log"; : > "$S/show.log"
  rm -f "$S/stub/listeners."* "$S/stub/listeners.fail" "$S/on/"* "$S/state/qa-started/"* 2>/dev/null || true
  for name in azurite keycloak functions langgraph backend; do
    case "$name" in keycloak) unit_file "$name" active exited oneshot 0 ;; *) unit_file "$name" active running simple 4242 ;; esac
  done
  printf 'azurite\tready\tconnected\nkeycloak\tready\tconnected\nfunctions\tready\tHTTP 200\nlanggraph\tready\tHTTP 200\nbackend\tready\tHTTP 200\n' > "$S/stub/probes"
  mkdir -p "$S/qa/apps/backend" "$S/stub/proc/4242"
  ln -sfn "$S/qa/apps/backend" "$S/stub/proc/4242/cwd"
  for name in azurite functions langgraph backend; do printf 'owned\t4242\tlistener\n' > "$S/stub/listeners.$name"; done
}
wt() { "$ROOT/bin/wt" backend "$@"; }
bash -n "$ROOT/bin/wt" "$ROOT/bin/qa-stack" "$ROOT/bin/qa-backend-serve"
reset
run 2 wt start
run 2 wt start 'backend;touch /tmp/should-never-exist'
run 2 wt start backend extra
run 2 wt restart
[ ! -s "$S/mutations.log" ] || fail 'invalid input mutated'
run 5 wt restart keycloak
run 5 wt restart azurite
[ ! -s "$S/show.log" ] || fail 'shared restart inspected units'
run 0 wt start backend
[ ! -s "$S/mutations.log" ] || fail 'already ready mutated'
printf 'foreign\t777\tlistener\n' > "$S/stub/listeners.backend"
run 2 wt start backend
[ ! -s "$S/mutations.log" ] || fail 'foreign ready mutated'
printf 'unknown\t?\tlistener owner unknown\n' > "$S/stub/listeners.backend"
run 6 wt start backend
reset; sed -i 's/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-backend.service"
run 6 wt start backend
reset; ln -sfn "$S/qa" "$S/stub/proc/4242/cwd"
run 0 wt start backend
reset; ln -sfn "$S/elsewhere" "$S/stub/proc/4242/cwd"
run 6 wt start backend
reset; sed -i 's/^ActiveState=active/ActiveState=activating/' "$S/units/wtfixture-qa-backend.service"
run 3 env WT_ENSURE_TIMEOUT=3 "$ROOT/bin/wt" backend start backend
[ ! -s "$S/mutations.log" ] || fail 'pending mutated'
reset; sed -i 's/^backend\tready/backend\tfailed/' "$S/stub/probes"
mkdir -p "$S/state/qa-started"
date +%s > "$S/state/qa-started/backend"
run 3 env WT_ENSURE_TIMEOUT=3 "$ROOT/bin/wt" backend start backend
[ ! -s "$S/mutations.log" ] || fail 'active pending mutated'
reset
flock "$S/state/qa-heal.lock" sleep 4 & lock_pid=$!
sleep 0.2
run 4 env WT_ENSURE_TIMEOUT=1 "$ROOT/bin/wt" backend start backend
wait "$lock_pid"
[ ! -s "$S/mutations.log" ] || fail 'busy lock mutated'
reset; sed -i 's/^ActiveState=active/ActiveState=inactive/; s/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-backend.service"
sed -i 's/^langgraph\tready/langgraph\tfailed/' "$S/stub/probes"
sed -i 's/^backend\tready/backend\tfailed/' "$S/stub/probes"
: > "$S/stub/listeners.backend"
run 5 wt start backend
[ ! -s "$S/mutations.log" ] || fail 'missing dependency mutated'
reset; sed -i 's/^ActiveState=active/ActiveState=failed/; s/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-backend.service"
sed -i 's/^backend\tready/backend\tfailed/' "$S/stub/probes"
: > "$S/stub/listeners.backend"
cat > "$S/on/start-wtfixture-qa-backend.service" <<'SH'
#!/usr/bin/env bash
sed -i 's/^ActiveState=failed/ActiveState=active/; s/^SubState=running/SubState=running/; s/^MainPID=0/MainPID=4242/' "$FIXTURE/units/wtfixture-qa-backend.service"
sed -i 's/^backend\tfailed/backend\tready/' "$FIXTURE/stub/probes"
printf 'owned\t4242\tlistener\n' > "$FIXTURE/stub/listeners.backend"
SH
chmod +x "$S/on/start-wtfixture-qa-backend.service"
run 0 wt start backend
grep -q '^reset-failed wtfixture-qa-backend.service$' "$S/mutations.log" || fail 'missing reset'
grep -q '^start --no-block wtfixture-qa-backend.service$' "$S/mutations.log" || fail 'missing target start'
[ -f "$S/state/qa-started/backend" ] || fail 'missing target stamp'
reset; sed -i 's/^ActiveState=active/ActiveState=inactive/; s/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-backend.service"
sed -i 's/^backend\tready/backend\tfailed/' "$S/stub/probes"
: > "$S/stub/listeners.backend"
cat > "$S/on/start-wtfixture-qa-backend.service" <<'SH'
#!/usr/bin/env bash
sed -i 's/^ActiveState=inactive/ActiveState=active/; s/^MainPID=0/MainPID=4242/' "$FIXTURE/units/wtfixture-qa-backend.service"
sed -i 's/^backend\tfailed/backend\tready/' "$FIXTURE/stub/probes"
printf 'foreign\t777\tlistener\n' > "$FIXTURE/stub/listeners.backend"
SH
chmod +x "$S/on/start-wtfixture-qa-backend.service"
run 2 wt start backend
grep -q 'already requested: start' "$S/err" || fail 'missing post-action warning'
[ "$(wc -l < "$S/mutations.log")" -eq 1 ] || fail 'post-action guard repeated mutation'
reset; sed -i 's/^ActiveState=active/ActiveState=failed/; s/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-backend.service"
sed -i 's/^backend\tready/backend\tfailed/' "$S/stub/probes"
: > "$S/stub/listeners.backend"
printf '#!/usr/bin/env bash\nsleep 20\n' > "$S/on/reset-failed-wtfixture-qa-backend.service"
chmod +x "$S/on/reset-failed-wtfixture-qa-backend.service"
run 1 env WT_ENSURE_TIMEOUT=12 "$ROOT/bin/wt" backend start backend
grep -q 'already requested: reset-failed' "$S/err" || fail 'slow reset phase missing'
[ "$(wc -l < "$S/mutations.log")" -eq 1 ] || fail 'slow reset issued another mutation'
! grep -q '^start ' "$S/mutations.log" || fail 'late start after slow reset'
[ ! -f "$S/state/qa-started/backend" ] || fail 'slow reset wrote startup stamp'
reset; sed -i 's/^ActiveState=active/ActiveState=inactive/; s/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-backend.service"
sed -i 's/^backend\tready/backend\tfailed/' "$S/stub/probes"
: > "$S/stub/listeners.backend"
printf '#!/usr/bin/env bash\nsleep 20\n' > "$S/on/start-wtfixture-qa-backend.service"
chmod +x "$S/on/start-wtfixture-qa-backend.service"
run 1 env WT_ENSURE_TIMEOUT=12 "$ROOT/bin/wt" backend start backend
grep -q 'already requested: start' "$S/err" || fail 'slow start phase missing'
[ "$(wc -l < "$S/mutations.log")" -eq 1 ] || fail 'slow start repeated mutation'
reset; run 0 wt restart functions
grep -q '^restart --no-block wtfixture-qa-functions.service$' "$S/mutations.log" || fail 'missing target restart'
! grep -q 'langgraph\|backend' "$S/mutations.log" || fail 'dependent changed'
reset; printf 'foreign\t777\tlistener\n' > "$S/stub/listeners.azurite"
run 0 wt start azurite
[ ! -s "$S/mutations.log" ] || fail 'external Azurite mutated'
reset; sed -i 's/^SubState=running/SubState=exited/' "$S/units/wtfixture-qa-backend.service"
run 6 wt start backend
reset; sed -i 's/^ActiveState=active/ActiveState=inactive/; s/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-keycloak.service"
run 0 wt start keycloak
[ ! -s "$S/mutations.log" ] || fail 'external Keycloak mutated'
reset; sed -i 's/^ActiveState=active/ActiveState=inactive/' "$S/units/wtfixture-qa-keycloak.service"
sed -i 's/^keycloak\tready/keycloak\tfailed/' "$S/stub/probes"
cat > "$S/on/start-wtfixture-qa-keycloak.service" <<'SH'
#!/usr/bin/env bash
sed -i 's/^ActiveState=inactive/ActiveState=active/' "$FIXTURE/units/wtfixture-qa-keycloak.service"
sed -i 's/^keycloak\tfailed/keycloak\tready/' "$FIXTURE/stub/probes"
SH
chmod +x "$S/on/start-wtfixture-qa-keycloak.service"
run 0 wt start keycloak
grep -q '^start --no-block wtfixture-qa-keycloak.service$' "$S/mutations.log" || fail 'Keycloak start missing'
[ ! -s "$S/devstart.log" ] || fail 'controller ran launcher hook'
reset; sed -i 's/^WorkingDirectory=.*/WorkingDirectory=\/elsewhere/' "$S/units/wtfixture-qa-backend.service"
run 6 wt start backend
[ ! -s "$S/mutations.log" ] || fail 'wrong tree mutated'
reset; run 6 env WT_QA_TREE="$S/other-qa" "$ROOT/bin/wt" backend start backend
[ ! -s "$S/mutations.log" ] || fail 'mismatched QA tree mutated'
reset; sed -i 's/^LoadState=loaded/LoadState=not-found/' "$S/units/wtfixture-qa-backend.service"
run 6 wt start backend
reset; sed -i 's/^MainPID=4242/MainPID=abc/' "$S/units/wtfixture-qa-backend.service"
run 6 wt start backend
reset; sed -i '/^SubState=/d' "$S/units/wtfixture-qa-backend.service"
run 6 wt start backend
reset; printf '#!/usr/bin/env bash\nsleep 1.2\n' > "$S/on/tick"; chmod +x "$S/on/tick"
run 4 env WT_ENSURE_TIMEOUT=1 "$ROOT/bin/wt" backend start backend
[ ! -s "$S/mutations.log" ] || fail 'late start after deadline'
reset; rm -f "$S/stub/listeners.backend"
cat > "$S/net/tcp" <<'EOF'
  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1F4A 00000000:0000 0A 00000000:00000000 00:00000000 00000000   100        0 4000000001
EOF
run 6 wt start backend
grep -q 'listener owner unknown' "$S/err" || fail 'missing ownerless listener detail'
mkdir -p "$S/stub/proc/4242/fd" "$S/stub/proc/4242"
printf '0::/user.slice/wtfixture-qa-backend.service\n' > "$S/stub/proc/4242/cgroup"
ln -s 'socket:[4000000001]' "$S/stub/proc/4242/fd/3"
run 0 wt start backend
rm -f "$S/stub/proc/4242/fd/3" "$S/stub/proc/4242/cgroup" "$S/net/tcp"
reset; sed -i 's/^ActiveState=active/ActiveState=inactive/; s/^MainPID=4242/MainPID=0/' "$S/units/wtfixture-qa-backend.service"
sed -i 's/^backend\tready/backend\tfailed/' "$S/stub/probes"
: > "$S/stub/listeners.backend"
run 0 env WT_DRY_RUN=1 WT_ENSURE_TIMEOUT=150 "$ROOT/bin/wt" backend start backend
[ ! -s "$S/mutations.log" ] || fail 'dry run mutated'
reset; run 0 "$ROOT/bin/wt" status --json
python3 - "$S/out" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); b=d['backend']; s=b['services']
assert d['schemaVersion']==2 and b['offset']==1 and b['offsetSource']=='file' and b['taskSlots']==[2,9]
assert b['treeAligned'] and s['backend']['ports'][0]['port']==8010
assert s['backend']['healthUrls'][0]==b['urls']['backend']
assert s['keycloak']['owner']=='container' and s['keycloak']['process']['container']['verified'] is False
assert s['keycloak']['commands']['restart'] is None and s['keycloak']['logsSource']=='systemd-launcher'
PY
[ ! -s "$S/journal.log" ] || fail 'status read journal'
[ "$(wc -l < "$S/show.log")" -eq 5 ] || fail 'status did not use one show per service'
reset; printf '#!/usr/bin/env bash\nsleep 3\n' > "$S/on/tick"; chmod +x "$S/on/tick"
run 0 timeout --kill-after=1 14 "$ROOT/bin/wt" status --json
python3 - "$S/out" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); assert set(d['backend']['services']) == {'azurite','keycloak','functions','langgraph','backend'}
assert all(s['unitLoad']=='loaded' for s in d['backend']['services'].values())
PY
[ "$(wc -l < "$S/show.log")" -eq 5 ] || fail 'slow status missed a show'
rm "$S/qa/.port-offset"
run 1 "$ROOT/bin/qa-stack" health --json
python3 - "$S/out" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); assert d['overall']=='unknown' and d['checkError'] and not d['services']
PY
run 0 "$ROOT/bin/wt" status --json
python3 - "$S/out" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); assert d['backend']['overall']=='unknown' and d['backend']['offsetSource']=='default'
PY
[ ! -e "$S/registry.json" ] || fail 'status allocated registry'
python3 - "$S/qa" "$S/registry.json" <<'PY'
import json,os,sys
with open(sys.argv[2],'w') as stream: json.dump({'claims':{os.path.realpath(sys.argv[1]):{'offset':1}}},stream)
PY
cp "$S/registry.json" "$S/registry.original"
run 0 "$ROOT/bin/wt" status --json
python3 - "$S/out" <<'PY'
import json,sys
d=json.load(open(sys.argv[1])); assert d['backend']['offsetSource']=='registry' and d['backend']['offset']==1
PY
cmp "$S/registry.json" "$S/registry.original" || fail 'status wrote registry'
echo "qa-services: $count cases passed"
