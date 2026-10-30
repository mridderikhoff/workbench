# Agent setup playbook

Canonical procedure for an agent asked to install, open, start or repair Overseer for a person.
The person uses the Overseer page and talks to you. **Never end with commands for them to run or a
server for them to start.** Finish in one of two states and report it:

- The Overseer page is up and the requested preview is ready, with real URLs; or
- the exact outside blocker (an admin password, a sign-in, an access grant, a missing secret) and
  what is already running.

Native macOS has been checked only against Linux stubs. Say so in your report until a real Mac run
passes the [smoke check](MACOS.md#native-smoke-check).

## Authority

A normal setup request authorizes user-space installs and managed startup: Homebrew packages,
the runtime-only tool links, the config file, a dedicated worktree, and starting Overseer units.
It does not authorize changing organization infrastructure, bypassing access or secrets policy,
`qa-stack adopt`, `qa-stack down`, `wt qa <branch>` (attaching a branch to the shared backend is a
separate, explicit request), or stopping something Overseer does not own. If the next step needs
the person (admin password, sign-in, access grant), ask for exactly that and resume after.

Never launch app servers directly (`pnpm dev`, `dev-start.sh`, `nx serve`, `uvicorn`, `func start`).
You may read the app repo's `local-app-runtime` and `env-sync` guidance for prerequisites, config
and credentials, but every launch goes through Overseer's managed units.

## 1. Discover before asking

Look first; ask one short question only for what you cannot find.

- **Workbench clone:** the parent of this file's `docs` folder, else `~/workbench`, else clone
  `https://github.com/mridderikhoff/workbench.git` to `~/workbench`.
- **Client and OS:** `uname -s`; which agent you are (Claude Code, Codex).
- **App repo:** `cl-strategy` checkout from `WT_MAIN_CHECKOUT`, `~/.config/overseer/runtime.env`, the
  current directory, or that app checkout's `git worktree list`. Confirm it contains `dev-start.sh`.
  If absent, clone `https://github.com/copperleaftech/cl-strategy.git` after checking access.
  Reuse existing worktrees and branches.
- **Which app:** `ds-demo`, `ri` or `strategy` from the request or branch context. If none, ask one
  concise choice. Do not guess credentials.
- **Tenant:** existing config, then the app repo's local setup. Ask only if RI or Strategy needs it
  and you cannot find it.
- **Config:** `~/.config/overseer/runtime.env` (or `OVERSEER_CONFIG_FILE`, absolute path). Read and reuse it.
  Variables already in your environment (`WT_MAIN_CHECKOUT`, `QA_TREE`, `WT_QA_TREE`, `WT_TENANT`,
  `WT_APPS`, `KC_LIB`, `QA_UNIT_DIR`, `WT_STATE_DIR`) win over the file; never overwrite either.

## 2. Prerequisites

- **macOS:** Homebrew with Bash 4.4+, `coreutils`, `flock` and Python 3.13+ (`brew install bash coreutils flock python@3.13`),
  plus Git. Initiate Homebrew and Xcode command-line-tools installation yourself using their official
  installers. If macOS requires an admin approval, present that OS prompt and resume afterwards;
  never ask for passwords in chat or give the person an installation command list.
- **Linux/WSL:** systemd user services, `git`, `python3`, `flock`.
- **Requested app:** `ds-demo` needs Git, Node and pnpm. RI and Strategy also need the app's backend
  prerequisites (Python 3.13 and uv, Azure Functions Core Tools, LangGraph, Podman or Docker for
  Keycloak, its Keycloak setup and credentials). Install what is user-space; report what needs access.
- For a `ds-demo`-only preview, skip backend, cloud and Keycloak dependencies.

## 3. Install and configure

1. `./install.sh --runtime-only --dry-run`, then `./install.sh --runtime-only` in the workbench clone.
   It links only `bin/*`; never install personal hooks or settings. **Rerun it after every tool update**
   so new helpers get linked.
2. Create `~/.config/overseer/runtime.env` only if it does not exist, with absolute values: `WT_MAIN_CHECKOUT`,
   `QA_TREE` and `WT_QA_TREE` (the same path; default `$HOME/cl-strategy-qa`), `WT_TENANT`, `KC_LIB`
   (normally `$QA_TREE/scripts/keycloak/local-common.sh`). Paths may contain spaces if quoted. Do not
   force the author's paths or tenant. In an existing file, fill only missing required settings using
   discovered values; preserve existing choices and explicit environment overrides. Omit a tenant
   when only `ds-demo` is requested. The tools load this file themselves, and the generated units
   read it through an `EnvironmentFile`, so no shell profile or unit drop-in is needed.
3. Find the QA tree: `git -C "$WT_MAIN_CHECKOUT" worktree list`, and look for `.wt-qa-runtime` and
   `.port-offset`. Reuse what exists. Only if missing, create a detached worktree of `origin/develop`
   at `$QA_TREE`, `touch .wt-qa-runtime`, write `1` to `.port-offset` if absent, and add
   `.wt-qa-runtime` to the shared `info/exclude` (absolute path from
   `git rev-parse --path-format=absolute --git-common-dir`). It must contain `dev-start.sh`. This tree only
   hosts the backend; service definitions live in the user's configuration directory. Never edit
   application source or serve frontends from the QA tree or the shared main checkout.

## 4. Start the Overseer page

```bash
~/.claude/bin/qa-stack install        # writes unit definitions; needs the QA tree from step 3
~/.claude/bin/overseer-systemctl --user enable --now cl-strategy-qa-dashboard.service
```

`overseer-systemctl` wraps `systemctl` on Linux and launchd on macOS. `qa-stack dashboard` only
prints the URL; it does not start anything. The page is at `http://127.0.0.1:5100` unless
`QA_DASHBOARD_PORT` is set. Verify with an HTTP request (a 200 response), not the command's exit code.

## 5. Start the requested app

1. **Worktree:** reuse the requested branch's worktree, or `~/.claude/bin/wt new <branch>` for a dedicated
   preview branch. Never serve from the main checkout or QA tree. Install that worktree's UI dependencies
   with `~/.claude/bin/wt deps <branch> apps/ui` before its first frontend start; creating a worktree
   alone does not install them.
2. **`ds-demo`:** `~/.claude/bin/wt serve <branch> ds-demo`. No backend needed; do not start one.
3. **`ri` or `strategy`:** finish the app prerequisites, then `~/.claude/bin/wt backend ensure` (or
   `~/.claude/bin/qa-stack up`, which also enables the watchdog), then
   `~/.claude/bin/wt serve <branch> ri` or `~/.claude/bin/wt serve <branch> strategy`.
   This does not attach your branch to the shared backend; leave another person's attachment alone.
4. **Verify readiness** from `~/.claude/bin/wt status --json`, not exit codes: the slot's app entry reports
   `unitState` is `active`, `httpReady` is `true`, and its actual `url` answers. Check `build.state`
   and browser output to confirm compilation; an HTTP response alone can still be a build error page.
   For backend apps, `backend.overall` must be `healthy`, `backend.treeAligned` must not be `false`,
   and every required service's `probe` must be `ready` with settled unit state. A ready probe on a unit
   still `activating` is not ready. A successful oneshot launcher can be ready with PID `0`.
5. **Sign-in:** open the page and let the person authenticate, then resume your checks.
6. Leave the units running and report the Overseer page URL and each app URL from the status JSON or the
   `wt serve` output (`<branch>.localhost` only if it reports the address was registered).

## 6. Link the Overseer skill (only when asked for agent plus page setup)

Link only `skills/overseer` for the detected client, never other global agent configuration:
Claude Code `~/.claude/skills/overseer`, Codex `~/.agents/skills/overseer`. Create the parent folder, and
link only if nothing exists there; if the path exists with a different target, keep it and report that.
Do not claim other clients discover it automatically.

## 7. Recovery

- After a reboot or sign-out, check the Overseer page; if it is down, rerun step 4. Its **Resume** action
  restarts saved sessions ([SESSION_RECOVERY.md](SESSION_RECOVERY.md)). No terminal needs to stay open.
- Backend or one service down: use the `overseer` skill and the [README agent reference](../README.md#agent-reference).
  Refusals (foreign process, unknown owner, wrong QA tree, held lock) are information: report the cause,
  do not bypass them.
- Missing dependency, access or secret: say exactly what and who can provide it, plus what is still running.
