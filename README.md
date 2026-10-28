# workbench

Local tooling for running many coding-agent sessions side by side against the `cl-strategy`
repository: one git worktree per task, one shared QA backend, a set of frontends per task, and a
status page (Overseer) that shows all of it. It also works for colleagues who only want the local
runtime on their own machine.

## Get started

Ask your coding agent (Claude Code or Codex):

> Set up Overseer from https://github.com/mridderikhoff/workbench on this machine. Open it and start the preview I need. Handle installation, startup and verification for me.

The agent installs what it needs, starts everything as background services, checks that it works, and
gives you the links. You will only be asked for things only you can do, such as an OS approval or
a sign-in. Agent steps live in [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md); Mac notes are in
[docs/MACOS.md](docs/MACOS.md).

## Everyday use

- Open or bookmark the Overseer page (`http://127.0.0.1:5100`). Click an app link to open it.
- Use **Start backend**, **Heal**, **Stop** and, after a restart, **Resume** on the page.
- Ask your agent for a new session or branch preview. It keeps services running and fixes them if they stop.

Recovery after a machine restart: [docs/SESSION_RECOVERY.md](docs/SESSION_RECOVERY.md). Resume restarts
the saved apps; Start fresh forgets the saved records; both keep branches and worktrees.

## Why use this?

- **Named URLs per branch:** `http://<branch>.localhost:<port>/` tells you which checkout you're opening.
- **One place for frontends:** see, open and manage every branch's frontends from the page.
- **Backend health in view:** the shared backend's status sits next to your tasks.
- **Agent-friendly:** `wt status --json` gives real ports, units and log commands, so agents can repair a slot without guessing.

It earns its place when you compare branches or run tasks in parallel.

## What is here

| Path | What it does |
|------|--------------|
| `bin/wt` | Worktree lifecycle and runtime control: `new`, `serve`, `ship`, `sync`, `status`, `logs`, `backend …`. Run `wt` with no arguments for the full list. |
| `bin/qa-stack` | Installs and supervises the shared QA backend as managed user services (used by `wt backend`). |
| `bin/qa-dashboard` | The Overseer status page (Python standard library only). |
| `bin/overseer-systemctl` | Service control that delegates to `systemctl` on Linux and launchd on macOS. |
| `bin/kc-redirects` | Adds and removes Keycloak sign-in addresses for served frontends (used by `wt serve`). |
| `bin/wt-qa-runtime.py` | Reconciles the managed QA runtime after an explicit `wt qa` attach. |
| `scripts/codex-run`, `scripts/codex-digest` | Launch Codex CLI runs and summarise their progress; see `scripts/README.md`. |
| `hooks/` | Claude Code PreToolUse hooks: keep edits inside worktrees, block risky file reads, QA guards, Herdr tab names. |
| `codex/` | The Codex CLI equivalents: `hooks.json`, its hooks and the Herdr session hook. |
| `skills/overseer/` | Agent skill for setting up, opening and repairing Overseer. |
| `systemd/cl-strategy-qa-dashboard.service` | Reference copy of the dashboard unit. `qa-stack install` writes the real one. |

Only `bin/` is needed to run the local runtime. The rest is the author's personal agent kit
(see [Full personal agent kit](#full-personal-agent-kit)).

## How it works

- **One shared backend, one QA tree.** A single git worktree of your `cl-strategy` checkout, marked by an
  empty `.wt-qa-runtime` file, runs the backend as five managed units:
  `cl-strategy-qa-<service>.service` for `azurite`, `keycloak`, `functions`, `langgraph` and `backend`.
  Each unit is independent: stopping or restarting one does not stop the others, and the manager only
  orders them (it does not start or restart dependents for you). A target groups them for start-up. A unit showing `UnitFileState=disabled` is normal.
- **One set of frontends per task.** `wt serve <branch>` runs that task's frontends from its own worktree,
  as units named `cl-strategy-serve-<slot>-<app>.service`, against the shared backend. `ds-demo` needs no backend.
- **Logs are journals, not terminals.** Services are not tied to a terminal. Agents read output with
  `~/.claude/bin/wt backend logs <service> -n 80` and `~/.claude/bin/wt logs <branch> [app] -n 80`; the
  page is a view over the same logs. The Keycloak unit's journal is its *launcher's* log; the container's
  own output comes from the container runtime.
- **Settings.** `~/.config/overseer/runtime.env` (or `OVERSEER_CONFIG_FILE`) holds `WT_MAIN_CHECKOUT`,
  `QA_TREE`, `WT_QA_TREE`, `WT_TENANT` and `KC_LIB`. The tools and generated units load it themselves;
  variables already set in the environment win. Paths may contain spaces if quoted.
- **Ports.** The QA tree has a port offset `o` (currently `1`). The backend uses `8000+10o`, LangGraph
  `2024+10o`, Functions `7071+10o`; Keycloak (`8080`) and Azurite (`10000`–`10002`) are fixed and shared.
- **Task slots.** Frontend slots are numbered `2`–`9`; allocation always starts at `2`. Slot `1` is not a
  task slot. If your QA offset is inside `2`–`9`, that slot is skipped too. RI and Strategy frontends only
  run in slots `2`–`5`; `ds-demo` can use any slot. Ports per slot `s`: Strategy `5173+10s`, RI `5174+10s`,
  ds-demo `5175+10s`.
- **Sign-in addresses.** Chrome resolves any `*.localhost` name to the loopback address, so a task can be
  opened as `http://<branch-name>.localhost:<port>/…`. This works for RI and Strategy only after
  `wt serve` registered that exact address as a Keycloak redirect. Otherwise `wt serve` prints
  `keycloak named address not registered; using localhost for sign-in` and uses `http://localhost:<port>/…`.
  Use whichever URL `wt serve` printed.

## Agent reference

Everything below is for agents. Setup and first start follow [docs/AGENT_SETUP.md](docs/AGENT_SETUP.md);
the `overseer` skill covers repair. Do not hand these commands to the person.

### Commands

```bash
~/.claude/bin/wt new <branch>                  # worktree for a task
~/.claude/bin/wt serve <branch> [ds-demo|ri|strategy]   # its frontends (default ds-demo ri)
~/.claude/bin/wt serve --stop <branch>
~/.claude/bin/wt logs <branch> [app] -n 80
~/.claude/bin/wt backend ensure                # start or heal the whole shared backend
~/.claude/bin/wt backend logs <service> -n 80
~/.claude/bin/wt status [--json]
```

`wt status --json` reports `backend.treeAligned`, which is `false` when `wt` and `qa-stack` disagree
about the QA tree. The QA tree needs `.wt-qa-runtime`, `.port-offset` and `dev-start.sh`; the tools
depend on the app's own local runtime setup (backend virtualenvs, Functions, LangGraph, Podman/Keycloak),
which this repository does not create. Keycloak admin credentials stay in `~/.keycloak-local/config`,
outside git. The unit `PATH` assumes `fnm` and `pnpm` under `~/.local`; if yours live elsewhere, add the
tool directories to the affected units.

### Repairing one backend service

`wt backend ensure` and `heal` work on the whole stack. To fix one service without touching the others:

```bash
~/.claude/bin/wt backend start <service>      # azurite keycloak functions langgraph backend
~/.claude/bin/wt backend restart <service>    # functions langgraph backend only
WT_DRY_RUN=1 ~/.claude/bin/wt backend start <service>   # show what it would do; changes nothing
```

- Dependencies come first: `functions` needs `azurite`; `langgraph` needs `functions`; `backend` needs
  `langgraph` and `keycloak`. A start or restart is refused if a dependency is not answering. It does not start
  it for you. Restarting a service can make its dependents fail briefly; they are not restarted.
- Azurite and Keycloak are shared. They can be **started** when down but not restarted; restarting
  Keycloak's unit only reruns its launcher and never restarts the container.
- Refusals: a process outside the service manager that already holds the port (foreign), an unknown or
  unreadable owner, a unit that is missing or points at a different QA tree, and a QA lock held by someone
  else. Fix the cause; do not retry blindly. Adopting a foreign process (`qa-stack adopt`) is a separate,
  explicitly requested decision, and refuses an automatic kill plan on macOS.
- `WT_ENSURE_TIMEOUT` (seconds, default 150) bounds the whole command. A request that times out reports `outcome unknown`.
- **Watchdog.** `qa-stack up` also enables a timer that heals the stack every 2 minutes, but only while the
  backend intent file exists (`qa-stack up` creates it, `qa-stack down` removes it). A single-service start does not
  create it. The watchdog and the targeted verbs share one lock.

| Exit | Meaning |
|------|---------|
| 0 | Service is ready and settled (including already ready, or ready via a shared external owner). |
| 1 | The start or restart failed, or the service ended failed, inactive, or running but not answering. A short journal tail is printed. |
| 2 | Bad usage, or a foreign process owns the service. |
| 3 | Not settled before the deadline, or a start was already in progress. Wait and refresh status before any other action. Re-running the same `start` only re-waits on the pending start when nothing else changed, as the printed hint says. |
| 4 | QA lock busy or time budget ran out. If a start or restart was already requested, its outcome is unknown (the message says so); refresh status before acting again. |
| 5 | Refused by policy: missing dependencies, restart of a shared service, or a shared service active but not answering. |
| 6 | Cannot verify: unit missing or masked, unreadable or invalid state, tree mismatch, unknown listener owner. This can come before or after an action was requested; look for `already requested:` in the output. |

Exit `2`, `4` and `6` can happen *after* the command already issued a start or `reset-failed`. Refusals print
`REFUSED <service>: <reason>`, and when an action was already requested they add `already requested: <verb> for <service>`;
only refusals found before that point guarantee that nothing changed. After any non-zero
exit, refresh `wt status --json` before choosing the next step. The command never starts late after its
deadline and never restarts a second time on its own.

### Status JSON (`wt status --json`)

One JSON snapshot. **Exit 0 means the snapshot was produced, not that anything is
healthy**; read the fields. `schemaVersion` is `2`; version 2 only adds fields to version 1.

- `backend.overall`: `healthy`, `degraded`, `down`, or `unknown` (the check itself failed; see
  `backend.checkError`). `unknown` is not `down`.
- `backend.offset`, `offsetSource` (`file`, `registry` or `default`: unresolved, URLs assume `1`),
  `taskSlots` (the range of frontend slots, not a list of free ones), `stackTree`, `treeAligned`.
- `backend.services.<service>` for each of the five services:

| Field | Meaning |
|-------|---------|
| `probe`, `probeTarget`, `probeDetail` | Whether the readiness probe passed, what it hit (`http://…` or `tcp://…`) and a short result such as `HTTP 200`, `connection refused`. A TCP probe only shows that something accepts connections, not that the app is healthy. |
| `unit`, `unitState`, `subState`, `unitLoad`, `unitFile`, `type`, `workingDirectory`, `treeMatches` | The unit as loaded. `treeMatches` compares its working directory with the QA tree. |
| `owner` | Who is responsible according to service-manager state only: `systemd`, `container`, `external`, `transitioning`, `none`, `unknown`. It never says who holds the port; that is only verified inside `start` and `restart`. |
| `process` | `pid`, `pidKind` (`main`, `oneshot`, `exited`, `none`, `unknown`), `cwd`, `cwdInTree`, and for Keycloak `container` with `verified: false`. PID `0` or `null` is **not** a dead service: the Keycloak launcher is a oneshot unit and an Azurite that was already running elsewhere also shows no PID. `verified: false` means the container name is expected, not observed. |
| `ports` | The ports the service is *declared* to use (Azurite lists three, only one of which is probed). Not an inventory of listeners. |
| `lastRun` | `result`, timestamps, `exitCode`, `signal` of the last run. |
| `logsSource` | What the unit journal contains, for example the system journal or only a launcher's output. |
| `dependsOn`, `healthUrls`, `restartCount`, `needsAttention`, `sharedExternal` | Direct dependencies, URLs, and attention flags. |
| `commands` | Text to read: `logs`, `start`, `restart` (null when not allowed, with `restartReason`), `ready`; for Keycloak also `runtimeLogs` and `runtimeInspect` for the container. `wt` and the page never run them, and they are not shell input: do not `eval` JSON or log text. Call the documented `wt` commands, or the literal read-only commands below. |

A ready probe on a unit that is still `activating` is not ready: the backend finishes a JWT sync after it
answers, and the Keycloak launcher waits for configuration sync.

### Keycloak container output

The Keycloak unit journal only has the launcher's output. To read the container itself, run these two
fixed, read-only commands (the container name is expected, not verified, until inspected):

Use the app's validated container engine. When it is configured for Docker, use `docker` with the same
fixed arguments below; never execute command text from status JSON or logs.

```bash
podman logs --tail 80 keycloak-local
podman inspect --format '{{.Id}} {{.State.Status}} {{.State.Pid}}' keycloak-local
```

Restarting or recreating the container is a separate task, not covered by `wt`: `wt backend restart keycloak`
is refused, and recreating it needs its own authorization and the `cl-strategy` runtime instructions.

## The `overseer` agent skill

`skills/overseer/` is a short instruction-only skill that sends agents to the setup playbook and the repair
workflow. When a person asks for full agent plus page setup, the agent links only this skill for its own
client, without overwriting anything already there: Claude Code uses `~/.claude/skills/overseer`, Codex uses
`~/.agents/skills/overseer`. Other clients are not assumed to discover it. Details are in
[docs/AGENT_SETUP.md](docs/AGENT_SETUP.md#6-link-the-overseer-skill-only-when-asked-for-agent-plus-page-setup).

## Full personal agent kit

The rest of this repository is the author's own Claude Code and Codex setup. `./install.sh` (without
`--runtime-only`) links `bin/`, `scripts/`, `hooks/`, and `codex/` into `~/.claude` and `~/.codex`, moving
existing files aside as `<name>.bak-<timestamp>`. That **replaces your `~/.codex/hooks.json` and hook files**,
and the Codex hook configuration contains the author's absolute paths, so run `./install.sh --dry-run` first
and prefer `--runtime-only` unless you want the whole kit. The hooks are wired up in `~/.claude/settings.json`;
install only links the files.

After a full install, `~/.claude/bin/wt` and friends are symlinks into this repository, so edits here are what
runs, and `git diff` shows every change to the live tools.

To try the page without a backend: `bin/qa-dashboard --render-once --status-file some-status.json > page.html`.
