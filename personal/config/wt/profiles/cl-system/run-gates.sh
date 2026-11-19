#!/usr/bin/env bash
# Usage:
#   wt gates <nx-project> --typecheck
#   wt gates <nx-project> --include <repo-relative path> [--include=<path> ...]
#   wt gates <nx-project>                         # full project lint and test

set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/nx-env.sh" || exit 1
cd "$wt_root" || exit 1

usage() {
  echo 'Usage: wt gates <nx-project> [--typecheck | --include <path> | --include=<path> ...] [--filter <text>]' >&2
  exit 2
}

[[ $# -ge 1 && "$1" != -* ]] || usage
project="$1"
shift
mode=full
includes=()
while (( $# )); do
  case "$1" in
    --typecheck)
      [[ "$mode" == full && $# -ge 1 ]] || usage
      mode=typecheck
      shift
      ;;
    --include)
      [[ "$mode" != typecheck && $# -ge 2 ]] || usage
      mode=scoped
      includes+=("$2")
      shift 2
      ;;
    --include=*)
      [[ "$mode" != typecheck && -n "${1#--include=}" ]] || usage
      mode=scoped
      includes+=("${1#--include=}")
      shift
      ;;
    --filter)
      [[ $# -ge 2 ]] || usage
      echo 'FAIL: --filter is unavailable: this Karma setup does not expose Jasmine name filtering.' >&2
      exit 2
      ;;
    *) usage ;;
  esac
done

graph_json="$(pnpm exec nx graph --print)" || exit 1
project_info="$(printf '%s' "$graph_json" | node -e '
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", () => {
  const graph = JSON.parse(input).graph;
  const name = process.argv[1];
  const node = graph.nodes[name];
  if (!node) process.exit(3);
  const data = node.data;
  const dependencies = new Set();
  function visit(project) {
    for (const edge of graph.dependencies[project] || []) {
      if (edge.target === name || dependencies.has(edge.target)) continue;
      dependencies.add(edge.target);
      visit(edge.target);
    }
  }
  visit(name);
  const buildable = [...dependencies].filter(project => graph.nodes[project]?.data.targets?.build);
  console.log([data.root, data.targets?.lint ? "1" : "0", data.targets?.test ? "1" : "0",
    data.targets?.build?.options?.tsConfig || "", data.targets?.test?.options?.tsConfig || "",
    buildable.join(",")].join("|"));
});
' "$project")"
info_status=$?
if (( info_status == 3 )); then
  echo "Unknown Nx project: $project" >&2
  exit 2
elif (( info_status != 0 )); then
  echo 'Could not read the Nx project graph.' >&2
  exit 1
fi
IFS='|' read -r project_root has_lint has_test lib_config spec_config dependencies <<< "$project_info"

lint_files=()
test_files=()
declare -A seen_lint=() seen_test=()
if [[ "$mode" == scoped ]]; then
  project_absolute="$(realpath "$project_root")"
  for included in "${includes[@]}"; do
    [[ "$included" != /* && -e "$included" ]] || { echo "Invalid included path: $included" >&2; exit 2; }
    absolute="$(realpath "$included")"
    [[ "$absolute" == "$project_absolute" || "$absolute" == "$project_absolute/"* ]] || { echo "Path outside project $project: $included" >&2; exit 2; }
    relative="${absolute#"$wt_root/"}"
    if [[ -d "$absolute" ]]; then
      mapfile -d '' -t candidates < <(git ls-files -z --cached --others --exclude-standard -- "$relative")
    else
      candidates=("$relative")
    fi
    for candidate in "${candidates[@]}"; do
      [[ -f "$candidate" ]] || continue
      case "$candidate" in
        *.ts|*.js|*.mjs|*.cjs|*.html)
          if [[ -z "${seen_lint[$candidate]+x}" ]]; then lint_files+=("$candidate"); seen_lint[$candidate]=1; fi
          ;;
      esac
      spec=""
      if [[ "$candidate" == *.spec.ts ]]; then
        spec="$candidate"
      elif [[ "$candidate" == *.ts || "$candidate" == *.html || "$candidate" == *.scss ]]; then
        if [[ -f "${candidate%.*}.spec.ts" ]]; then spec="${candidate%.*}.spec.ts"; fi
      fi
      if [[ -n "$spec" && -z "${seen_test[$spec]+x}" ]]; then test_files+=("$spec"); seen_test[$spec]=1; fi
    done
  done
fi

passed=0
failed=0
run_gate() {
  local name="$1"
  shift
  echo "--- Gate: $name ---"
  if "$@"; then
    echo "PASS: $name"
    ((passed+=1))
  else
    echo "FAIL: $name"
    ((failed+=1))
  fi
}
skip_gate() { echo "SKIP: $1"; }

if [[ "$mode" == typecheck ]]; then
  if [[ -n "$dependencies" ]]; then
    run_gate dependency-build pnpm exec nx run-many -t build "--projects=$dependencies"
  else
    skip_gate dependency-build
  fi
  if (( failed == 0 )); then
    [[ -n "$lib_config" ]] || { if [[ -f "$project_root/tsconfig.lib.json" ]]; then lib_config="$project_root/tsconfig.lib.json"; elif [[ -f "$project_root/tsconfig.app.json" ]]; then lib_config="$project_root/tsconfig.app.json"; fi; }
    [[ -n "$spec_config" ]] || { if [[ -f "$project_root/tsconfig.spec.json" ]]; then spec_config="$project_root/tsconfig.spec.json"; fi; }
    if [[ -n "$lib_config" ]]; then run_gate source-typecheck pnpm exec tsc --noEmit -p "$lib_config"; else skip_gate source-typecheck; fi
    if [[ -n "$spec_config" ]]; then run_gate spec-typecheck pnpm exec tsc --noEmit -p "$spec_config"; else skip_gate spec-typecheck; fi
  fi
elif [[ "$mode" == scoped ]]; then
  if (( ${#lint_files[@]} == 0 && ${#test_files[@]} == 0 )); then
    echo 'SKIP: nothing to lint or test in the --include paths'
    echo 'Gate summary: 0 passed, 0 failed'
    exit 0
  fi
  if [[ "$has_lint" == 1 && ${#lint_files[@]} -gt 0 ]]; then
    run_gate lint pnpm exec eslint "${lint_files[@]}"
  else
    skip_gate lint
  fi
  if [[ "$has_test" == 1 && ${#test_files[@]} -gt 0 ]]; then
    test_args=()
    for spec in "${test_files[@]}"; do test_args+=("--include=$spec"); done
    run_gate test env CI=true pnpm exec nx test "$project" --watch=false --browsers=ChromeHeadlessCI --codeCoverage=false "${test_args[@]}"
  else
    skip_gate test
  fi
else
  if [[ "$has_lint" == 1 ]]; then run_gate lint pnpm exec nx lint "$project"; else skip_gate lint; fi
  if [[ "$has_test" == 1 ]]; then
    run_gate test env CI=true pnpm exec nx test "$project" --watch=false --browsers=ChromeHeadlessCI
  else
    skip_gate test
  fi
fi

echo "Gate summary: $passed passed, $failed failed"
(( failed == 0 ))
