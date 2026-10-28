# Overseer on macOS

Overseer runs natively on macOS as per-user launchd agents. The `wt` and `qa-stack` commands are the same
as on Linux, and no Linux VM is needed.

## Set up

Ask your coding agent:

> Set up Overseer from https://github.com/mridderikhoff/workbench on this Mac. Open it and start the preview I need. Handle installation, startup and verification for me.

The agent follows [AGENT_SETUP.md](AGENT_SETUP.md): it installs the Mac prerequisites, writes the settings,
starts everything as background services, checks it, and gives you the links. It asks you only for things
only you can do, such as approving an OS installation prompt, signing in, or granting repository access.

Day to day, open or bookmark `http://localhost:5100`, click app links, and use **Start backend**, **Heal**,
**Resume** and **Stop** on the page. Ask your agent for new sessions. After a restart or sign-out the agent
repairs a missing page, and **Resume** restores saved sessions
([SESSION_RECOVERY.md](SESSION_RECOVERY.md)). No terminal has to stay open.

## Agent reference

- **Prerequisites:** Homebrew with Bash 4.4+, GNU coreutils, `flock` and Python 3.13+
  (`brew install bash coreutils flock python@3.13`), plus Git. The tools add Homebrew's `bin` and `gnubin`
  directories to `PATH` themselves (`/opt/homebrew` on Apple Silicon, `/usr/local` on Intel).
  `install.sh --runtime-only --dry-run` checks them and prints the links it would make. The installer never
  installs Homebrew or application dependencies; the setup agent handles those and presents any OS approval prompts.
- **Application prerequisites** (Node and pnpm; for RI and Strategy also Python 3.13 and uv, Azure Functions
  Core Tools, LangGraph, Docker or Podman for Keycloak) come from the app repo's `local-app-runtime` and
  `env-sync` guidance. A `ds-demo` preview needs far fewer and no backend.
- **Settings:** `~/.config/overseer/runtime.env`; shell quoting allows spaces in paths. The CLI and the
  generated launchd jobs both load it. Reuse an existing file.
- **Services:** definitions are generated under `~/.config/overseer/units` (`QA_UNIT_DIR` overrides).
  The adapter stages LaunchAgent plists in its local state directory and keeps enabled agents under
  `~/Library/LaunchAgents`. Logs are in Overseer's
  local state directory and readable through `wt logs` and `wt backend logs`. The watchdog runs every two minutes.
  The page is at `http://localhost:5100` unless `QA_DASHBOARD_PORT` is set.
- **Start order:** `qa-stack install`, then
  `~/.claude/bin/overseer-systemctl --user enable --now cl-strategy-qa-dashboard.service` for the page alone
  (`ds-demo`), or `qa-stack up` / `wt backend ensure` plus `wt serve <branch> <app>` for backend apps.
  Verify with `wt status --json` and HTTP checks, as in [AGENT_SETUP.md](AGENT_SETUP.md#5-start-the-requested-app).
- **Foreign ports:** if a legacy process holds a QA port, `qa-stack` refuses to take ownership, and
  `qa-stack adopt` refuses an automatic kill plan on macOS. Report the owner; do not stop a shared Keycloak
  or Azurite just because it is external.

## Native smoke check

**Not yet run on a real Mac.** The Linux stub tests check command routing and safety behavior, but cannot
establish that launchd starts the applications. An agent runs this on a Mac after setup and reports the result:

1. `qa-stack install`, `qa-stack up`, `wt status --json`: confirm the page, watchdog and expected backend services appear with the correct QA tree.
2. Open `http://localhost:5100`; compare `wt backend logs backend -n 30` with the page's log tail and health.
3. `wt serve <branch> ds-demo`: open its URL, inspect `wt logs <branch> ds-demo`, then `wt serve --stop <branch>`.
4. Confirm `wt backend ensure` repairs a stopped owned service, and a foreign listener causes a refusal without stopping its process.
5. After sign-out and back in, confirm the page and watchdog return and branch status is accurate.

All commands use `~/.claude/bin/`.
