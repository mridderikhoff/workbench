# Way of working

My personal tooling for running many coding-agent sessions side by side against the cl-strategy
repository: one worktree per task, a shared QA backend, per-task frontends, and a status page to
watch it all.

## What is here

| Path | What it does |
|------|--------------|
| `bin/wt` | Worktree lifecycle: `new`, `serve`, `ship`, `sync`, `status`, `logs`, `backend ensure/heal/update`. Run `wt` with no arguments for the full list. |
| `bin/qa-stack` | Starts and supervises the shared QA backend as systemd user units (used by `wt backend`). |
| `bin/qa-dashboard` | The local QA status page (Python standard library only). Shows the backend, every task slot and its apps, and can update, heal or start the backend and stop a slot's servers. |
| `bin/kc-redirects` | Adds and removes Keycloak redirect addresses for served frontends (used by `wt serve`). |
| `bin/wt-qa-runtime.py` | Reconciles the managed QA runtime after an explicit `wt qa` attach. |
| `scripts/codex-run`, `scripts/codex-digest` | Launch Codex CLI runs and summarise their progress; see `scripts/README.md`. |
| `hooks/` | Claude Code PreToolUse hooks: keep edits inside worktrees, block risky file reads, QA guards, Herdr tab names. |
| `systemd/cl-strategy-qa-dashboard.service` | The user unit that keeps the dashboard running (reference copy). |

## Install

```bash
git clone <this repo> ~/way-of-working
cd ~/way-of-working
./install.sh --dry-run   # shows what would be linked
./install.sh             # links bin/, scripts/ and hooks/ into ~/.claude, backing up what was there
```

After installing, `~/.claude/bin/wt` and friends are symlinks into this repository, so edits here
are what runs, and `git diff` shows every change to the live tools.

The dashboard serves on `http://127.0.0.1:5100` (`QA_DASHBOARD_PORT` overrides it). To try it
without a backend: `bin/qa-dashboard --render-once --status-file some-status.json > page.html`.

## Using this on another machine

The tools still assume my setup in a few places. Override them with environment variables:

- `WT_MAIN_CHECKOUT`: the shared checkout (default `/home/marica/cl-strategy`).
- `WT_TENANT`: the tenant in frontend URLs (default `mridderikhoff`; the dashboard lets you change it in Settings).
- `KC_LIB`: the Keycloak helper script (default inside `/home/marica/cl-strategy-qa`).

The hooks are wired up in `~/.claude/settings.json`; install only links the files.
