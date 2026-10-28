# Overseer on macOS

Overseer uses native per-user launchd agents on macOS. The `wt` and `qa-stack` commands are the same as on Linux. A Linux VM is not required.

## Before installing

Install Homebrew, then install Bash 4.4 or newer, GNU coreutils, `flock`, and Python 3.13:

```bash
brew install bash coreutils flock python@3.13
```

Keep `/opt/homebrew/bin` (Apple Silicon) or `/usr/local/bin` (Intel) available. The tools add those directories and Homebrew's `gnubin` directory at startup. `install.sh --runtime-only --dry-run` checks the prerequisites and prints the links it would make without changing files. The installer never installs Homebrew or application dependencies for you.

The underlying `cl-strategy` runtime also needs Git, Node and pnpm, Python 3.13 and uv, Azure Functions Core Tools, LangGraph, and a local container runtime such as Docker or Podman for Keycloak. Follow that application's local runtime setup before expecting its backend or RI frontend to start. The designer's `ds-demo` frontend has fewer dependencies.

## Configure one machine

1. Clone this repository and preview then install the runtime tools:

   ```bash
   git clone https://github.com/mridderikhoff/workbench.git "$HOME/workbench"
   cd "$HOME/workbench"
   ./install.sh --runtime-only --dry-run
   ./install.sh --runtime-only
   ```

2. Put your checkout paths and tenant in `~/.config/overseer/runtime.env`. Use absolute paths and shell quoting for paths with spaces. The CLI, agents, and launchd jobs load this same file:

   ```bash
   mkdir -p "$HOME/.config/overseer"
   cat > "$HOME/.config/overseer/runtime.env" <<EOF
   WT_MAIN_CHECKOUT="$HOME/cl-strategy"
   QA_TREE="$HOME/cl-strategy-qa"
   WT_QA_TREE="$HOME/cl-strategy-qa"
   WT_TENANT="your-tenant"
   KC_LIB="$HOME/cl-strategy-qa/scripts/keycloak/local-common.sh"
   EOF
   ```

   Review an existing file instead of overwriting it. The QA tree must be a dedicated worktree with `.wt-qa-runtime` and `.port-offset` as described in the [shared setup](../README.md#setup-on-your-own-machine). The runtime never creates the application dependencies or Keycloak configuration.

3. Once the QA tree and application prerequisites are ready, install the service definitions and start the shared runtime:

   ```bash
   "$HOME/.claude/bin/qa-stack" install
   "$HOME/.claude/bin/qa-stack" up
   "$HOME/.claude/bin/wt" status --json
   ```

   Native service definitions live under `~/.config/overseer/units` by default; `QA_UNIT_DIR` overrides this. The adapter generates LaunchAgent plists for each service, the watchdog timer, dashboard, and task frontends. Logs are stored under Overseer's local state directory and remain available through `wt logs` and `wt backend logs`. The watchdog checks every two minutes. The dashboard is at `http://localhost:5100` unless `QA_DASHBOARD_PORT` is set.

## Everyday use

```bash
"$HOME/.claude/bin/wt" new <branch>
"$HOME/.claude/bin/wt" serve <branch> ds-demo
"$HOME/.claude/bin/wt" status --json
"$HOME/.claude/bin/wt" logs <branch> ds-demo -n 80
"$HOME/.claude/bin/wt" backend ensure
```

If a legacy process already holds a QA port, `qa-stack` refuses to take ownership. On macOS, `qa-stack adopt` deliberately refuses an automatic kill plan; inspect and stop the old launcher yourself before running `qa-stack up` again. Do not stop a shared Keycloak or Azurite process just because it is external.

## Native smoke check

Run this on a Mac after setup. The Linux stub tests check command routing and safety behavior, but cannot establish that launchd starts the applications on your machine.

1. `qa-stack install`, `qa-stack up`, and `wt status --json`: confirm dashboard, watchdog, and expected backend services appear with the correct QA tree.
2. Open `http://localhost:5100`, run `wt backend logs backend -n 30`, and confirm the log tail and health status match.
3. Run `wt serve <branch> ds-demo`, open its printed URL, inspect `wt logs <branch> ds-demo`, then `wt serve --stop <branch>`.
4. Verify `wt backend ensure` repairs a stopped owned service, and confirm a foreign listener causes a refusal without stopping its process.
5. Sign out and back in; confirm enabled dashboard and watchdog agents return and branch status remains accurate.
