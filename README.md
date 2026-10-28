# workbench

Local tooling for running many coding-agent sessions side by side against the `cl-strategy`
repository: one git worktree per task, one shared QA backend, a set of frontends per task, and a
status page that shows all of it. It also works for colleagues who only want the local runtime
(backend, frontends, status page) on their own machine, with or without agents.

Recovering sessions after a machine restart is described in [docs/SESSION_RECOVERY.md](docs/SESSION_RECOVERY.md).

## Why use this?

Comparing branches usually means juggling terminals, tabs, ports and a backend you hope is healthy. This gives you:

- **Named URLs per branch:** `http://<branch>.localhost:<port>/` tells you which checkout you're opening, so you spend less time matching ports to branches.
- **One place for frontends:** see, open and manage every branch's frontends from the status page or `wt`.
- **Backend health in view:** the shared backend's status sits next to your tasks. Check individual services and logs with `wt backend`.
- **Agent-friendly:** `wt status --json` gives real ports, units and log commands, so agents can repair a slot without guessing.

It earns its place when you compare branches or run tasks in parallel. For one branch and one frontend, your usual start command may be enough.

## What is here

| Path | What it does |
|------|--------------|
| `bin/wt` | Worktree lifecycle and runtime control: `new`, `serve`, `ship`, `sync`, `status`, `logs`, `backend …`. Run `wt` with no arguments for the full list. |
| `bin/qa-stack` | Installs and supervises the shared QA backend as systemd user units (used by `wt backend`). |
| `bin/qa-dashboard` | The local status page (Python standard library only). Shows the backend, every task slot and its apps. |
| `bin/kc-redirects` | Adds and removes Keycloak sign-in addresses for served frontends (used by `wt serve`). |
| `bin/wt-qa-runtime.py` | Reconciles the managed QA runtime after an explicit `wt qa` attach. |
| `scripts/codex-run`, `scripts/codex-digest` | Launch Codex CLI runs and summarise their progress; see `scripts/README.md`. |
| `hooks/` | Claude Code PreToolUse hooks: keep edits inside worktrees, block risky file reads, QA guards, Herdr tab names. |
| `codex/` | The Codex CLI equivalents: `hooks.json`, its hooks and the Herdr session hook. |
| `skills/overseer/` | Optional agent skill that teaches the `wt` repair commands below. |
| `systemd/cl-strategy-qa-dashboard.service` | Reference copy of the dashboard unit. `qa-stack install` writes the real one. |

Only `bin/` is needed to run the local runtime. The rest is the author's personal agent kit
(see [Full personal agent kit](#full-personal-agent-kit)).

## How it works

- **One shared backend, one QA tree.** A single git worktree of your `cl-strategy` checkout, marked by an
  empty `.wt-qa-runtime` file, runs the backend as five systemd user units:
  `cl-strategy-qa-<service>.service` for `azurite`, `keycloak`, `functions`, `langgraph` and `backend`.
  Each unit is independent: stopping or restarting one does not stop the others, and systemd only orders
  them (it does not start or restart dependents for you). A target groups them for start-up. A unit
  showing `UnitFileState=disabled` is normal.
- **One set of frontends per task.** `wt serve <branch>` runs that task's frontends from its own worktree,
  as units named `cl-strategy-serve-<slot>-<app>.service`, against the shared backend.
- **Logs are journals, not terminals.** Services are not tied to a terminal. Read output with
  `~/.claude/bin/wt backend logs <service> -n 80` and `~/.claude/bin/wt logs <branch> [app] -n 80`; the
  dashboard and the herdr tab are only views over the same journals.
  The Keycloak unit's journal is its *launcher's* log; the container's own output comes from the container
  runtime (the status JSON gives the text of the command to show, see below).
- **Ports.** The QA tree has a port offset `o` (currently `1`). The backend uses `8000+10o`, LangGraph
  `2024+10o`, Functions `7071+10o`; Keycloak (`8080`) and Azurite (`10000`–`10002`) are fixed and shared.
- **Task slots.** Frontend slots are numbered `2`–`9`; allocation always starts at `2`, whatever the QA
  offset is. Slot `1` is not a task slot. The default QA offset `1` already uses that port band for the
  backend. If your QA offset is inside `2`–`9`, that slot is skipped too; changing the offset does not make
  `1` available. RI and Strategy frontends only run in slots `2`–`5`; `ds-demo` can use any slot. Ports per
  slot `s`: Strategy `5173+10s`, RI `5174+10s`, ds-demo `5175+10s`.
- **Sign-in addresses.** Chrome resolves any `*.localhost` name to the loopback address, so a task can be
  opened as `http://<branch-name>.localhost:<port>/…`. This works for RI and Strategy only after
  `wt serve` registered that exact address as a Keycloak redirect. If registration failed or is not set up,
  `wt serve` prints `keycloak named address not registered; using localhost for sign-in` and the URLs it
  prints use `http://localhost:<port>/…`. Use whichever URL `wt serve` printed.

## Setup on your own machine

On macOS, use [the native Mac setup](docs/MACOS.md). It uses per-user launchd agents and the same
`wt`, `qa-stack`, and Overseer commands. The Linux/WSL setup below needs systemd user services,
plus `git`, `python3`, `flock`, Node with `pnpm`, and
everything the `cl-strategy` local RI runtime already needs (backend virtualenvs, Functions, LangGraph,
Podman/Keycloak and its local setup). If the local Keycloak container or its setup does not exist yet,
do not look for it here: follow the `cl-strategy` `local-app-runtime` skill and the instructions printed by
its `start_keycloak.py`. This repository does not create it.

The order matters: the dashboard unit does not exist until step 5 installs it.

1. **Install the tools.** Prefer the runtime-only install; preview it first:
   ```bash
   git clone https://github.com/mridderikhoff/workbench.git ~/workbench && cd ~/workbench
   ./install.sh --runtime-only --dry-run   # shows what would be linked
   ./install.sh --runtime-only             # links bin/* into ~/.claude/bin only
   ```
   It backs up any existing file as `<name>.bak-<timestamp>`. It also links `~/.codex/bin/wt` when you
   already have a `~/.codex` directory. It does not touch scripts, hooks or Codex hook configuration.
2. **Write one settings file.** The tools default to the author's paths in a few places, so every
   process that runs them (your shell, agents started from it, and the dashboard) must see the same values.
   Keep them in one file, `~/.config/overseer/runtime.env`, with absolute values:

   | Variable | Meaning |
   |----------|---------|
   | `WT_MAIN_CHECKOUT` | your main `cl-strategy` checkout |
   | `QA_TREE` | the QA tree, as used by `qa-stack` (default `$HOME/cl-strategy-qa`) |
   | `WT_QA_TREE` | the QA tree, as used by `wt`; set it to the same path as `QA_TREE` |
   | `WT_TENANT` | tenant in frontend URLs |
   | `KC_LIB` | Keycloak helper script, normally `$QA_TREE/scripts/keycloak/local-common.sh` |

   If the file already exists, read it and reuse it; do not overwrite it.
   ```bash
   mkdir -p ~/.config/overseer
   if [ -e ~/.config/overseer/runtime.env ]; then
     cat ~/.config/overseer/runtime.env
   else
     main=$HOME/cl-strategy          # your main checkout; edit these two lines
     tenant=your-tenant
     cat > ~/.config/overseer/runtime.env <<EOT
   WT_MAIN_CHECKOUT=$main
   QA_TREE=$HOME/cl-strategy-qa
   WT_QA_TREE=$HOME/cl-strategy-qa
   WT_TENANT=$tenant
   KC_LIB=$HOME/cl-strategy-qa/scripts/keycloak/local-common.sh
   EOT
   fi
   ```
   The heredoc is unquoted on purpose, so `$HOME` is expanded when the file is written. systemd does not
   expand variables inside an `EnvironmentFile`, and values must not contain spaces. Load it into every
   shell you use the tools from (each new shell needs this; add it to your shell profile if you like):
   ```bash
   set -a; . ~/.config/overseer/runtime.env; set +a
   ```
   **Each process needs its own copy.** Sourcing the file in one shell does not carry over to agents or tools
   started by systemd, T3, an IDE or another host process, or to later tool calls that each get a fresh shell.
   Give that host the same file (as an `EnvironmentFile`, as for the dashboard below), or load it in the same
   command, for example `set -a; . ~/.config/overseer/runtime.env; set +a; ~/.claude/bin/wt status --json`.
   `wt status --json` reports `backend.treeAligned`, which is `false` when `wt` and `qa-stack` disagree
   about the QA tree.
3. **Find or create the QA tree.** Look before you create anything, and reuse an existing QA tree and
   offset. With the settings from step 2 loaded:
   ```bash
   git -C "$WT_MAIN_CHECKOUT" worktree list
   ls -a "$QA_TREE"/.wt-qa-runtime "$QA_TREE"/.port-offset 2>&1
   cat "$QA_TREE"/.port-offset 2>/dev/null
   ```
   Only if `$QA_TREE` does not exist, create a detached worktree of your main checkout, the marker and the offset:
   ```bash
   git -C "$WT_MAIN_CHECKOUT" worktree add --detach "$QA_TREE" origin/develop
   touch "$QA_TREE"/.wt-qa-runtime
   [ -e "$QA_TREE"/.port-offset ] || echo 1 > "$QA_TREE"/.port-offset
   ```
   The marker is untracked. Keep it out of the dirty check by excluding it in the shared git directory (not
   `.gitignore`). The path must be absolute, or it lands in the wrong repository:
   ```bash
   exclude=$(git -C "$WT_MAIN_CHECKOUT" rev-parse --path-format=absolute --git-common-dir)/info/exclude
   mkdir -p "$(dirname "$exclude")"
   grep -qxF .wt-qa-runtime "$exclude" 2>/dev/null || echo .wt-qa-runtime >> "$exclude"
   ```
   `.port-offset` is already gitignored. Offset `1` keeps the QA tree away from offset `0`, which a normal dev
   checkout uses. On a new machine the port registry (`~/.cl-strategy-local/offsets.json`) is empty, and
   without `.port-offset` the first offset lookup would claim the lowest free number. If the registry already
   has claims, check that none collides with the offset you chose.
   `dev-start.sh` and `scripts/dev/ports.py` are tracked in `cl-strategy`, so the new tree has them.
   Install the tree's dependencies the way the `cl-strategy` local runtime documents.
4. **Give the dashboard and the watchdog the same settings.** Shell exports do not reach systemd. The
   dashboard runs `wt` for you, and the watchdog (the timer that heals the backend and syncs the named sign-in
   addresses) needs `KC_LIB`, or it falls back to the author's Keycloak helper path. Add a drop-in to each unit
   that reads the file, using an absolute path (written with `$HOME` expanded), then reload:
   ```bash
   for unit in dashboard watchdog; do
     dropin=$HOME/.config/systemd/user/cl-strategy-qa-$unit.service.d
     mkdir -p "$dropin"
     cat > "$dropin"/env.conf <<EOT
   [Service]
   EnvironmentFile=$HOME/.config/overseer/runtime.env
   EOT
   done
   systemctl --user daemon-reload
   ```
   Neither unit exists yet, so do not restart anything here. The drop-ins survive `qa-stack install`.
5. **Install and start the units** (you run this once; agents use `wt` afterwards). With the settings loaded,
   `qa-stack` uses the same `QA_TREE`:
   ```bash
   ~/.claude/bin/qa-stack install
   ~/.claude/bin/qa-stack up      # starts the backend units and enables the dashboard
   ```
   The service units use the QA tree as their working directory, and `qa-backend-serve` runs from `QA_TREE`
   when it is set, otherwise from the unit's working directory. The unit `PATH` assumes `fnm` and `pnpm`
   under `~/.local`; if yours live elsewhere, add the tool directories with a drop-in on the affected units.
   Keycloak admin credentials for `kc-redirects` stay in `~/.keycloak-local/config`, outside git.
   On a fresh machine this is the whole flow: the units start with the drop-ins already in place. Only if a
   dashboard unit was already running before you added its drop-in, restart it once:
   `systemctl --user restart cl-strategy-qa-dashboard.service`. The watchdog is a timer-run one-shot unit, so
   its next run picks the drop-in up after `daemon-reload`.
6. **Check.** `~/.claude/bin/wt status` for a summary, `~/.claude/bin/wt status --json` for details, or open
   `http://127.0.0.1:5100` (`QA_DASHBOARD_PORT` overrides the port).

## Everyday use

```bash
~/.claude/bin/wt new <branch>                  # worktree for a task
~/.claude/bin/wt serve <branch> [ds-demo|ri|strategy]   # its frontends (default ds-demo ri)
~/.claude/bin/wt serve --stop <branch>
~/.claude/bin/wt logs <branch> [app] -n 80
~/.claude/bin/wt backend ensure                # start or heal the whole shared backend
~/.claude/bin/wt backend logs <service> -n 80
~/.claude/bin/wt status [--json]
```

After a restart, Overseer offers to resume or forget saved sessions; see
[docs/SESSION_RECOVERY.md](docs/SESSION_RECOVERY.md). Resume restarts the saved apps, Start fresh forgets the
saved records; both keep branches and worktrees.

## Repairing one backend service

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
- Refusals: a process outside systemd that already holds the port (foreign), an unknown or unreadable owner,
  a unit that is missing or points at a different QA tree, and a QA lock held by someone else. Fix the cause;
  do not retry blindly. Adopting a foreign process is a manual `qa-stack adopt` decision.
- `WT_ENSURE_TIMEOUT` (seconds, default 150) bounds the whole command, including waiting for the QA lock and
  for the service to settle. A request that times out reports `outcome unknown`.
- **Watchdog.** `qa-stack up` also enables a timer that heals the stack every 2 minutes, but only while the
  backend intent file exists (`qa-stack up` creates it, `qa-stack down` removes it). A single-service start does not
  create it, and prints a note when it is absent. The watchdog and the targeted verbs share one lock, so they
  do not act at the same time.

| Exit | Meaning |
|------|---------|
| 0 | Service is ready and settled (including already ready, or ready via a shared external owner). |
| 1 | The start or restart failed, or the service ended failed, inactive, or running but not answering. A short journal tail is printed. |
| 2 | Bad usage, or a foreign process owns the service. |
| 3 | Not settled before the deadline, or a start was already in progress. Wait and refresh status before any other action. Re-running the same `start` only re-waits on the pending start when nothing else changed, as the printed hint says. |
| 4 | QA lock busy or time budget ran out. If a start or restart was already requested, its outcome is unknown (the message says so); refresh status before acting again. |
| 5 | Refused by policy: missing dependencies, restart of a shared service, or a shared service active but not answering. |
| 6 | Cannot verify: unit missing or masked, unreadable or invalid state, tree mismatch, unknown listener owner. This can come before or after an action was requested; look for `already requested:` in the output. |

Exit `2`, `4` and `6` can happen *after* the command already issued a start or `reset-failed` (for example a
foreign listener appears while it waits). Refusals print `REFUSED <service>: <reason>`, and when an action was already
requested they add `already requested: <verb> for <service>`; only refusals found before that point guarantee that nothing changed. After any non-zero
exit, refresh `wt status --json` before choosing the next step. The command never starts late after its
deadline and never restarts a second time on its own.

## Status for agents (`wt status --json`)

`wt status --json` prints one JSON snapshot. **Exit 0 means the snapshot was produced, not that anything is
healthy**; read the fields. `schemaVersion` is `2`; version 2 only adds fields to version 1.

- `backend.overall`: `healthy`, `degraded`, `down`, or `unknown` (the check itself failed; see
  `backend.checkError`). `unknown` is not `down`.
- `backend.offset`, `offsetSource` (`file`, `registry` or `default`: unresolved, URLs assume `1`),
  `taskSlots` (the range of frontend slots, not a list of free ones), `stackTree`, `treeAligned`.
- `backend.services.<service>` for each of the five services:

| Field | Meaning |
|-------|---------|
| `probe`, `probeTarget`, `probeDetail` | Whether the readiness probe passed, what it hit (`http://…` or `tcp://…`) and a short result such as `HTTP 200`, `connection refused`. A TCP probe only shows that something accepts connections, not that the app is healthy. |
| `unit`, `unitState`, `subState`, `unitLoad`, `unitFile`, `type`, `workingDirectory`, `treeMatches` | The systemd unit as loaded. `treeMatches` compares its working directory with the QA tree. |
| `owner` | Who is responsible according to systemd state only: `systemd`, `container`, `external`, `transitioning`, `none`, `unknown`. It never says who holds the port; that is only verified inside `start` and `restart`. |
| `process` | `pid`, `pidKind` (`main`, `oneshot`, `exited`, `none`, `unknown`), `cwd`, `cwdInTree`, and for Keycloak `container` with `verified: false`. PID `0` or `null` is **not** a dead service: the Keycloak launcher is a oneshot unit and an Azurite that was already running elsewhere also shows no PID. `verified: false` means the container name is expected, not observed. |
| `ports` | The ports the service is *declared* to use (Azurite lists three, only one of which is probed). Not an inventory of listeners. |
| `lastRun` | `result`, timestamps, `exitCode`, `signal` of the last run. |
| `logsSource` | What the unit journal contains, for example the systemd journal or only a launcher's output. |
| `dependsOn`, `healthUrls`, `restartCount`, `needsAttention`, `sharedExternal` | Direct dependencies, URLs, and attention flags. |
| `commands` | Text for people and agents to read: `logs`, `start`, `restart` (null when not allowed, with `restartReason`), `ready`; for Keycloak also `runtimeLogs` and `runtimeInspect` for the container. `wt` and the dashboard never run them, and they are not shell input: do not `eval` JSON or log text. Call the documented `wt` commands, or the literal read-only commands in the next section. |

### Keycloak container output

The Keycloak unit journal only has the launcher's output. To read the container itself, an agent or person may
run these two fixed, read-only commands (the container name is expected, not verified, until inspected):

```bash
podman logs --tail 80 keycloak-local
podman inspect --format '{{.Id}} {{.State.Status}} {{.State.Pid}}' keycloak-local
```

Restarting or recreating the container is a separate task, not covered by `wt`: `wt backend restart keycloak`
is refused, and recreating it needs its own authorization and the `cl-strategy` runtime instructions.

A ready probe on a unit that is still `activating` is not ready: the backend finishes a JWT sync after it
answers, and the Keycloak launcher waits for configuration sync.

## Optional: the `overseer` agent skill

Agents can drive everything above with the CLI alone. If you use Codex and want it to discover the repair
workflow on its own, `skills/overseer/` is a short instruction-only skill. It is opt-in: install nothing by
default and edit no global agent settings. To enable it, link the folder yourself, without overwriting
anything already there:

```bash
mkdir -p ~/.agents/skills
[ -e ~/.agents/skills/overseer ] || ln -s ~/workbench/skills/overseer ~/.agents/skills/overseer
```

Then invoke it as `$overseer`, or let Codex pick it from its description (implicit discovery is on by
default). Codex looks for `SKILL.md` folders in `~/.agents/skills` and a repository's `.agents/skills`;
symlinked folders are supported. See the
[official skill documentation](https://learn.chatgpt.com/docs/build-skills) for the install convention.

## Full personal agent kit

The rest of this repository is the author's own Claude Code and Codex setup. `./install.sh` (without
`--runtime-only`) links `bin/`, `scripts/`, `hooks/`, and `codex/` into `~/.claude` and `~/.codex`, moving
existing files aside as `<name>.bak-<timestamp>`. That **replaces your `~/.codex/hooks.json` and hook files**,
and the Codex hook configuration contains the author's absolute paths, so run `./install.sh --dry-run` first
and prefer `--runtime-only` unless you want the whole kit. The hooks are wired up in `~/.claude/settings.json`;
install only links the files.

After a full install, `~/.claude/bin/wt` and friends are symlinks into this repository, so edits here are what
runs, and `git diff` shows every change to the live tools.

To try the dashboard without a backend: `bin/qa-dashboard --render-once --status-file some-status.json > page.html`.
