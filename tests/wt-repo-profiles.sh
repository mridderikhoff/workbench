#!/usr/bin/env bash
# Isolated profile exercise; git fixtures and service stubs stay in $S.
set -euo pipefail
ROOT=$(cd "$(dirname "$0")/.." && pwd)
S=$(mktemp -d "${TMPDIR:-/tmp}/wt-profiles.XXXXXX")
trap 'rm -rf -- "$S"' EXIT
fail() { echo "FAIL: $*" >&2; exit 1; }

mkdir -p "$S/cl-strategy" "$S/cl-system" "$S/home" "$S/bin" "$S/state" "$S/units"
for repo in cl-strategy cl-system; do
  git init -q -b develop "$S/$repo"
  git -C "$S/$repo" config user.name Fixture
  git -C "$S/$repo" config user.email fixture@example.test
  printf '.claude/\n' >"$S/$repo/.gitignore"
done
printf 'strategy\n' >"$S/cl-strategy/README.md"
mkdir -p "$S/cl-strategy/apps/ui"
touch "$S/cl-strategy/apps/ui/pnpm-lock.yaml"
git -C "$S/cl-strategy" add .
git -C "$S/cl-strategy" commit -qm base
mkdir -p "$S/cl-system/scripts" "$S/profiles"
cat >"$S/profiles/cl-system.json" <<'PROFILE'
{
  "name": "cl-system",
  "checkout": "REPLACE_CHECKOUT",
  "baseBranch": "develop",
  "deps": ["."],
  "nodeModules": ".",
  "backend": false,
  "nxSharedCache": true,
  "defaultApps": ["system-docs"],
  "apps": {
    "system-docs": {
      "label": "Docs",
      "portBase": 5176,
      "cwd": ".",
      "command": "bash scripts/wt-serve-docs.sh --port {port}",
      "urlPath": "/",
      "backend": false
    }
  }
}
PROFILE
sed -i "s|REPLACE_CHECKOUT|$S/cl-system|" "$S/profiles/cl-system.json"
touch "$S/cl-system/pnpm-lock.yaml"
printf '#!/usr/bin/env bash\n' >"$S/cl-system/scripts/wt-serve-docs.sh"
git -C "$S/cl-system" add .
git -C "$S/cl-system" commit -qm base

cat >"$S/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$PWD" >>"$FIXTURE/pnpm-cwds"
mkdir -p node_modules
STUB
cat >"$S/bin/systemctl" <<'STUB'
#!/usr/bin/env bash
case "$*" in
  *is-active*) echo inactive ;;
  *show*) printf 'LoadState=not-found\nActiveState=inactive\n' ;;
esac
STUB
cat >"$S/bin/qa-stack" <<'STUB'
#!/usr/bin/env bash
case "${1:-}" in
  health) printf '{"overall":"unknown","services":{}}\n' ;;
  *) echo "unexpected qa-stack call: $*" >&2; exit 7 ;;
esac
STUB
chmod +x "$S/bin/"*
export FIXTURE="$S" HOME="$S/home" TMPDIR="$S" PATH="$S/bin:$PATH"
export WT_REPOS="$S/cl-strategy:$S/cl-system" WT_PROFILE_DIR="$S/profiles" WT_STATE_DIR="$S/state"
export QA_UNIT_DIR="$S/units" WT_QA_STACK_BIN="$S/bin/qa-stack"
export WT_DRY_RUN=1 WT_STUB_PORTS='' OVERSEER_CONFIG_FILE="$S/no-runtime.env"

# Profiles select real main checkouts, and can supply the known repo list.
ln -s "$S/cl-system" "$S/system-link"
python3 - "$S/profiles/cl-system.json" "$S/system-link" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path))
data['checkout'] = sys.argv[2]
with open(path, 'w') as stream: json.dump(data, stream)
PY
[ "$(python3 "$ROOT/bin/wt-profile.py" "$S/cl-system" name)" = cl-system ] || fail 'symlinked checkout did not match realpath'
[ "$(python3 "$ROOT/bin/wt-profile.py" "$S/system-link" name)" = cl-system ] || fail 'symlink checkout path did not match'
unset WT_REPOS
[ "$(python3 "$ROOT/bin/wt-profile.py" / known)" = "$S/cl-system" ] || fail 'known repo was not derived from profile'
(cd "$S/home" && "$ROOT/bin/wt" new derived-feature >"$S/out") || fail 'derived known repo context failed'
[ -d "$S/cl-system/.claude/worktrees/derived-feature" ] || fail 'derived context chose wrong repo'
export WT_REPOS="$S/cl-strategy:$S/cl-system"
mkdir -p "$S/missing-profiles"
[ "$(WT_PROFILE_DIR="$S/missing-profiles" python3 "$ROOT/bin/wt-profile.py" "$S/cl-strategy" name)" = cl-strategy ] || fail 'missing profile directory lost fallback'
cp "$S/profiles/cl-system.json" "$S/profiles/duplicate.json"
if python3 "$ROOT/bin/wt-profile.py" "$S/cl-system" name >"$S/out" 2>&1; then fail 'duplicate profile accepted'; fi
grep -Fq 'cl-system.json and ' "$S/out" || fail 'duplicate error omitted both files'
rm "$S/profiles/duplicate.json"
python3 - "$S/profiles/cl-system.json" "$S/profiles/duplicate.json" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
data['name'] = 'other-docs'
with open(sys.argv[2], 'w') as stream: json.dump(data, stream)
PY
if python3 "$ROOT/bin/wt-profile.py" "$S/cl-system" name >"$S/out" 2>&1; then fail 'duplicate checkout accepted'; fi
grep -Fq 'cl-system.json and ' "$S/out" || fail 'duplicate checkout error omitted both files'
rm "$S/profiles/duplicate.json"
printf '{invalid json\n' >"$S/profiles/invalid.json"
[ "$(python3 "$ROOT/bin/wt-profile.py" "$S/cl-system" name 2>"$S/warning")" = cl-system ] || fail 'invalid profile blocked valid profile'
grep -Fq 'invalid.json' "$S/warning" || fail 'invalid profile warning omitted file'
rm "$S/profiles/invalid.json"

# Current-repo commands use the matching checkout; outside either repo uses the first known one.
(cd "$S/cl-strategy" && "$ROOT/bin/wt" new strategy-feature >"$S/out") || fail 'strategy context failed'
[ -d "$S/cl-strategy/.claude/worktrees/strategy-feature" ] || fail 'strategy worktree in wrong repo'
(cd "$S/cl-system" && "$ROOT/bin/wt" new docs-feature >"$S/out") || fail 'profile context failed'
mkdir -p "$S/linkbin" && ln -s "$ROOT/bin/wt" "$S/linkbin/wt" && ln -s "$ROOT/bin/overseer-env.sh" "$S/linkbin/overseer-env.sh"
(cd "$S/cl-system" && "$S/linkbin/wt" list >/dev/null) || fail 'wt run through a symlink cannot find wt-profile.py'
docs_tree="$S/cl-system/.claude/worktrees/docs-feature"
[ -d "$docs_tree" ] || fail 'profile worktree in wrong repo'
(cd "$docs_tree" && "$ROOT/bin/wt" new nested-feature >"$S/out") || fail 'profile worktree context failed'
[ -d "$S/cl-system/.claude/worktrees/nested-feature" ] || fail 'nested profile context used wrong repo'
(cd "$S/home" && "$ROOT/bin/wt" new fallback-feature >"$S/out") || fail 'HOME-like context failed'
[ -d "$S/cl-strategy/.claude/worktrees/fallback-feature" ] || fail 'HOME-like context used wrong repo'

# A repository file has no effect on user profile selection.
mkdir -p "$S/cl-system/.workbench"
printf '{"name":"stray"}\n' >"$S/cl-system/.workbench/wt.json"
(cd "$S/cl-system" && "$ROOT/bin/wt" list >/dev/null) || fail 'stray repository profile was read'
[ "$(python3 "$ROOT/bin/wt-profile.py" "$S/cl-system" name)" = cl-system ] || fail 'stray repository profile changed selection'

# Branch lookup crosses known repos and installs from the profile's root workspace.
(cd "$S/home" && "$ROOT/bin/wt" deps docs-feature >"$S/out") || fail 'profile deps failed'
[ "$(cat "$S/pnpm-cwds" 2>/dev/null)" = "$docs_tree" ] || fail 'pnpm did not run in profile root'
[ -d "$docs_tree/node_modules" ] || fail 'profile node_modules missing'

# A backend-free app can use slot 6 with no QA runtime tree.
(cd "$S/home" && "$ROOT/bin/wt" serve docs-feature >"$S/out") || fail 'profile serve failed'
unit="$S/units/cl-strategy-serve-6-system-docs.service"
record="$S/state/wt-serve/slot-6"
command_script="$S/state/wt-serve/command-6-system-docs.sh"
[ -f "$unit" ] || fail 'profile unit missing or wrong slot'
[ -f "$record" ] || fail 'profile slot record missing'
grep -Fqx "WorkingDirectory=$docs_tree/." "$unit" || fail 'profile unit working directory wrong'
grep -Fq 'bash scripts/wt-serve-docs.sh --port 5236' "$command_script" || fail 'profile command or port wrong'
grep -Fq "NX_CACHE_DIRECTORY=$S/home/.cache/wt-nx/cl-system/cache" "$unit" || fail 'shared Nx cache missing'
grep -Fq "NX_WORKSPACE_DATA_DIRECTORY=$S/home/.cache/wt-nx/cl-system/data" "$unit" || fail 'shared Nx data directory missing'
grep -Fqx 'repo=cl-system' "$record" || fail 'slot record lost repo'

if (cd "$S/home" && "$ROOT/bin/wt" serve docs-feature ri >"$S/out" 2>&1); then
  fail 'foreign app was accepted'
fi
grep -Fq 'cl-system' "$S/out" || fail 'foreign app error did not name repo'
grep -Fq 'system-docs' "$S/out" || fail 'foreign app error did not list available apps'

(cd "$S/home" && "$ROOT/bin/wt" status --json >"$S/status.json") || fail 'status failed'
python3 - "$S/status.json" "$docs_tree" <<'PY' || fail 'profile status item wrong'
import json, sys
data = json.load(open(sys.argv[1], encoding='utf-8'))
slot = next(item for item in data['slots'] if item['branch'] == 'docs-feature')
app, = slot['apps']
assert slot['slot'] == 6 and slot['repo'] == 'cl-system'
assert slot['worktree'] == sys.argv[2]
assert app['app'] == 'system-docs' and app['label'] == 'Docs'
assert app['backend'] is False and app['port'] == 5236
assert app['url'] == 'http://docs-feature.localhost:5236/'
assert not slot.get('error'), slot.get('error')
PY

(cd "$S/home" && "$ROOT/bin/wt" serve --stop docs-feature >"$S/out") || fail 'stop outside repos failed'
[ ! -e "$record" ] || fail 'stop kept profile slot record'
[ ! -e "$unit" ] || fail 'stop kept profile unit'

# The built-in profile keeps its apps/ui dependency location and unit bytes.
strategy_tree="$S/cl-strategy/.claude/worktrees/strategy-feature"
(cd "$S/home" && "$ROOT/bin/wt" serve strategy-feature ds-demo >"$S/out") || fail 'built-in serve failed'
grep -Fq "install frontend dependencies in $strategy_tree/apps/ui" "$S/out" || fail 'built-in serve checked the wrong node_modules'
unit="$S/units/cl-strategy-serve-6-ds-demo.service"
record="$S/state/wt-serve/slot-6"
[ -f "$unit" ] || fail 'built-in unit missing'
unit_env_path="$HOME/.local/share/fnm/aliases/default/bin:$HOME/.local/bin:$HOME/.local/share/pnpm:/usr/local/bin:/usr/bin:/bin"
cat >"$S/expected-builtin.service" <<EOF_UNIT
[Unit]
Description=cl-strategy task frontend 6 ds-demo
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
WorkingDirectory=$strategy_tree/apps/ui
EnvironmentFile=-$OVERSEER_CONFIG_FILE
Environment="OVERSEER_CONFIG_FILE=$OVERSEER_CONFIG_FILE"
Environment="PATH=$unit_env_path"
Environment="PNPM_HOME=$HOME/.local/share/pnpm"
Environment=NX_DAEMON=false
ExecStart=/usr/bin/env bash -lc 'cd $strategy_tree/apps/ui && pnpm exec nx serve ds-demo --port 5235'
Restart=on-failure
RestartSec=5
KillMode=control-group
TimeoutStartSec=300

[Install]
WantedBy=default.target
EOF_UNIT
cmp -s "$S/expected-builtin.service" "$unit" || {
  diff -u "$S/expected-builtin.service" "$unit" >&2 || true
  fail 'built-in unit changed'
}
cp "$unit" "$S/unit-without-profile.service"
python3 - "$ROOT/personal/config/wt/profiles/cl-strategy.json" "$S/profiles/cl-strategy.json" "$S/cl-strategy" <<'PY'
import json, sys
data = json.load(open(sys.argv[1]))
data['checkout'] = sys.argv[3]
with open(sys.argv[2], 'w') as stream: json.dump(data, stream)
PY
python3 - "$ROOT/bin/wt-profile.py" "$S/cl-strategy" <<'PY' || fail 'strategy file differs from built-in settings'
import importlib.util, sys
spec = importlib.util.spec_from_file_location('wt_profile', sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
actual = module.profile(sys.argv[2]).copy()
actual.pop('checkout')
assert actual == module.FALLBACK
PY
[ "$(python3 "$ROOT/bin/wt-profile.py" / known | head -1)" = "$S/cl-strategy" ] || fail 'cl-strategy was not first derived known repo'
(cd "$S/home" && "$ROOT/bin/wt" serve strategy-feature ds-demo >"$S/out") || fail 'file-backed strategy serve failed'
cmp -s "$S/unit-without-profile.service" "$unit" || fail 'cl-strategy file changed unit bytes'
(cd "$S/home" && WT_DRY_RUN=0 "$ROOT/bin/wt" serve strategy-feature ds-demo >"$S/out") || fail 'built-in serve dependency install failed'
[ "$(tail -n 1 "$S/pnpm-cwds")" = "$strategy_tree/apps/ui" ] || fail 'built-in serve installed the wrong workspace'
[ "$(wc -l <"$S/pnpm-cwds")" = 2 ] || fail 'built-in serve installed extra workspaces'
(cd "$S/home" && "$ROOT/bin/wt" deps strategy-feature >"$S/out") || fail 'built-in deps failed'
[ "$(tail -n 1 "$S/pnpm-cwds")" = "$strategy_tree/apps/ui" ] || fail 'built-in deps did not use apps/ui'
[ "$(wc -l <"$S/pnpm-cwds")" = 3 ] || fail 'built-in deps installed another workspace'

# Older records have no repo field and still identify the built-in repository.
sed -i '/^repo=/d' "$record"
(cd "$S/home" && "$ROOT/bin/wt" status --json >"$S/status.json") || fail 'legacy slot status failed'
python3 - "$S/status.json" <<'PY' || fail 'legacy slot record not loaded'
import json, sys
data = json.load(open(sys.argv[1], encoding='utf-8'))
slot = next(item for item in data['slots'] if item['branch'] == 'strategy-feature')
assert slot['repo'] == 'cl-strategy' and slot['apps'][0]['app'] == 'ds-demo'
assert not slot.get('error'), slot.get('error')
PY
(cd "$S/home" && "$ROOT/bin/wt" serve --stop strategy-feature >"$S/out") || fail 'legacy slot stop failed'
[ ! -e "$record" ] || fail 'legacy slot stop kept record'
[ ! -e "$unit" ] || fail 'legacy slot stop kept unit'

# A profile command stays shell data; systemd receives an escaped percent path.
cp "$S/profiles/cl-system.json" "$S/docs-profile.json"
mkdir -p "$docs_tree/docs%folder"
python3 - "$S/profiles/cl-system.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding='utf-8'))
data['apps']['system-docs']['cwd'] = 'docs%folder'
data['apps']['system-docs']['command'] = 'echo $HOME/% --port {port}'
with open(path, 'w', encoding='utf-8') as file:
    json.dump(data, file)
PY
(cd "$S/cl-system" && "$ROOT/bin/wt" serve docs-feature >"$S/out") || fail 'profile command serve failed'
unit="$S/units/cl-strategy-serve-6-system-docs.service"
record="$S/state/wt-serve/slot-6"
command_script="$S/state/wt-serve/command-6-system-docs.sh"
grep -Fqx "WorkingDirectory=$docs_tree/docs%%folder" "$unit" || fail 'unit did not escape percent in cwd'
grep -Fqx "ExecStart=/usr/bin/env bash -l $command_script" "$unit" || fail 'unit did not use command script'
grep -Fq 'echo $HOME/% --port 5236' "$command_script" || fail 'command script changed shell variables or percent'
(cd "$S/home" && "$ROOT/bin/wt" serve --stop docs-feature >"$S/out") || fail 'profile command stop failed'

python3 - "$S/profiles/cl-system.json" <<'PY'
import json, sys
path = sys.argv[1]
data = json.load(open(path, encoding='utf-8'))
data['apps']['system-docs']['command'] = 'echo first\necho second'
with open(path, 'w', encoding='utf-8') as file:
    json.dump(data, file)
PY
if (cd "$S/cl-system" && "$ROOT/bin/wt" serve docs-feature >"$S/out" 2>&1); then
  fail 'profile command with newline was accepted'
fi
[ ! -e "$record" ] || fail 'invalid command created a slot record'
[ ! -e "$unit" ] || fail 'invalid command created a unit'
cp "$S/docs-profile.json" "$S/profiles/cl-system.json"

# Same-named branches may have independent slots, but HOME cannot identify one to stop or log.
git -C "$S/cl-strategy" worktree add -q -b docs-feature "$S/cl-strategy/.claude/worktrees/docs-feature" develop
strategy_docs_tree="$S/cl-strategy/.claude/worktrees/docs-feature"
(cd "$S/cl-system" && "$ROOT/bin/wt" serve docs-feature system-docs >"$S/out") || fail 'duplicate profile serve failed'
(cd "$S/cl-strategy" && "$ROOT/bin/wt" serve docs-feature ds-demo >"$S/out") || fail 'duplicate built-in serve failed'
[ -f "$S/state/wt-serve/slot-6" ] && [ -f "$S/state/wt-serve/slot-7" ] || fail 'duplicate branches did not get separate slots'
if (cd "$S/home" && "$ROOT/bin/wt" serve --stop docs-feature >"$S/out" 2>&1); then
  fail 'ambiguous stop succeeded'
fi
grep -Fq "$docs_tree" "$S/out" || fail 'ambiguous stop omitted profile path'
grep -Fq "$strategy_docs_tree" "$S/out" || fail 'ambiguous stop omitted built-in path'
[ -f "$S/state/wt-serve/slot-6" ] && [ -f "$S/state/wt-serve/slot-7" ] || fail 'ambiguous stop changed slots'
if (cd "$S/home" && "$ROOT/bin/wt" logs docs-feature >"$S/out" 2>&1); then
  fail 'ambiguous logs succeeded'
fi
grep -Fq "$docs_tree" "$S/out" || fail 'ambiguous logs omitted profile path'
grep -Fq "$strategy_docs_tree" "$S/out" || fail 'ambiguous logs omitted built-in path'
(cd "$S/cl-system" && "$ROOT/bin/wt" serve --stop docs-feature >"$S/out") || fail 'contextual profile stop failed'
(cd "$S/cl-strategy" && "$ROOT/bin/wt" serve --stop docs-feature >"$S/out") || fail 'contextual built-in stop failed'
echo 'wt-profiles: all cases passed'
