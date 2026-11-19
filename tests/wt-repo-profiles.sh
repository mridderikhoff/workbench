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
git -C "$S/cl-strategy" add .
git -C "$S/cl-strategy" commit -qm base
mkdir -p "$S/cl-system/.workbench" "$S/cl-system/scripts"
cat >"$S/cl-system/.workbench/wt.json" <<'PROFILE'
{
  "name": "cl-system",
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
export WT_REPOS="$S/cl-strategy:$S/cl-system" WT_STATE_DIR="$S/state"
export QA_UNIT_DIR="$S/units" WT_QA_STACK_BIN="$S/bin/qa-stack"
export WT_DRY_RUN=1 WT_STUB_PORTS='' OVERSEER_CONFIG_FILE="$S/no-runtime.env"

# Current-repo commands use the matching checkout; outside either repo uses the first known one.
(cd "$S/cl-strategy" && "$ROOT/bin/wt" new strategy-feature >"$S/out") || fail 'strategy context failed'
[ -d "$S/cl-strategy/.claude/worktrees/strategy-feature" ] || fail 'strategy worktree in wrong repo'
(cd "$S/cl-system" && "$ROOT/bin/wt" new docs-feature >"$S/out") || fail 'profile context failed'
docs_tree="$S/cl-system/.claude/worktrees/docs-feature"
[ -d "$docs_tree" ] || fail 'profile worktree in wrong repo'
(cd "$docs_tree" && "$ROOT/bin/wt" new nested-feature >"$S/out") || fail 'profile worktree context failed'
[ -d "$S/cl-system/.claude/worktrees/nested-feature" ] || fail 'nested profile context used wrong repo'
(cd "$S/home" && "$ROOT/bin/wt" new fallback-feature >"$S/out") || fail 'HOME-like context failed'
[ -d "$S/cl-strategy/.claude/worktrees/fallback-feature" ] || fail 'HOME-like context used wrong repo'

# Branch lookup crosses known repos and installs from the profile's root workspace.
(cd "$S/home" && "$ROOT/bin/wt" deps docs-feature >"$S/out") || fail 'profile deps failed'
[ "$(cat "$S/pnpm-cwds" 2>/dev/null)" = "$docs_tree" ] || fail 'pnpm did not run in profile root'
[ -d "$docs_tree/node_modules" ] || fail 'profile node_modules missing'

# A backend-free app can use slot 6 with no QA runtime tree.
(cd "$S/home" && "$ROOT/bin/wt" serve docs-feature >"$S/out") || fail 'profile serve failed'
unit="$S/units/cl-strategy-serve-6-system-docs.service"
record="$S/state/wt-serve/slot-6"
[ -f "$unit" ] || fail 'profile unit missing or wrong slot'
[ -f "$record" ] || fail 'profile slot record missing'
grep -Fqx "WorkingDirectory=$docs_tree/." "$unit" || fail 'profile unit working directory wrong'
grep -Fq 'bash scripts/wt-serve-docs.sh --port 5236' "$unit" || fail 'profile command or port wrong'
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
echo 'wt-profiles: all cases passed'
