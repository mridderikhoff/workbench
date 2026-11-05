---
name: t3
description: "Start, stop, check, update, and explain the local T3 Code server (the open-source web control plane for Claude Code / Codex threads at localhost:3773) running inside WSL. Use when the user runs /t3 or explicitly asks to start, stop, restart, check, pair, update, or explain T3 Code. Not for Herdr or grunt sessions."
---

# T3 Code

T3 Code is a server (`t3`) plus a web UI. Each thread drives the real `claude` or `codex` CLI
in a project directory, so `~/.claude` settings, hooks, skills, and `CLAUDE.md` still apply
(verify with the hook check below before relying on it).

## Setup on this machine

- Installed inside WSL by `https://t3.codes/install.sh`: binary symlink `~/.local/bin/t3`,
  versions under `~/.t3/runtime/versions/`, data under `~/.t3/userdata/` (logs in `logs/`).
- UI: `http://localhost:3773` from a Windows browser (WSL localhost forwarding). Confirm the
  port from the server's startup output; don't assume it.
- Providers use existing logins: `claude auth status`, `codex login status`.
- The Windows desktop app's "WSL backend" mode is deliberately not used — it evaluates paths and
  Git from the Windows side and has open WSL bugs.

## Server rule

The user's global rule is that agents never start servers. An explicit `/t3 start` (or a direct
request this turn to start/restart T3) is the authorization — it covers only T3, only this turn.
Anything else (status, explain) never starts it.

## Commands

Parse the user's argument (`/t3 <verb>`); with none, run **status** then show the verb list.

**status** — always safe:
```bash
t3 --version; t3 service status
pgrep -af '/t3 (serve|start)|/t3$' | grep -v pgrep
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3773/ || echo "not reachable"
```
Report: installed version, service installed or not, ad-hoc process PID if any, reachable or not.

**start** — ask which mode if the user didn't say (default: ad-hoc for a pilot):
- *ad-hoc* (lives until stopped or WSL shuts down):
  ```bash
  cd ~ && setsid -f t3 serve --no-browser "$HOME" > ~/.t3/userdata/logs/serve.log 2>&1 < /dev/null
  ```
  Then, in a separate call (the log needs ~5 s), show the startup lines without the migration list:
  ```bash
  grep -viE "^\s+'[0-9]+_|migrations:|^\s*\]" ~/.t3/userdata/logs/serve.log | grep -E 'Listening|ready|Connection|Token|Pairing|ERROR|WARN'
  ```
  Start from `$HOME`, never the shared checkout — the start directory becomes the default
  provider working directory. Use `setsid -f` (not `setsid … &`); a trailing `&` keeps the
  shell tool attached until its timeout. Relay the pairing URL exactly as printed; the token is
  one-time, and a paired browser afterwards needs only `http://localhost:3773`.
- *service* (persistent, systemd user unit): `t3 service install`, then **status**.
Refuse to start a second instance when **status** shows one running.

**stop**:
- ad-hoc: `pkill -f '/t3 serve'` (or the PID from **status**), then confirm it's gone.
- service: `t3 service uninstall` stops and removes it (the CLI has no plain stop; find the
  unit with `systemctl --user list-units | grep -i t3` and `systemctl --user stop <unit>` if the
  user wants it kept installed). Projects and threads are kept either way.

**restart**: service → `t3 service restart`; ad-hoc → stop, then start.

**pair** — a new browser, phone, or an "invalid pairing token" error: pairing tokens expire
after 5 minutes by default (including the one `serve` prints at startup), so mint a fresh one:
`t3 pair --ttl 1h --label <client> 2>&1 | grep -vE '^[ █▀▄]+$'` (the grep drops the QR code).
Relay the pairing URL and expiry.

**update**: `t3 update` (also switches the service). Report old → new version.

**logs**: `tail -50 ~/.t3/userdata/logs/serve.log`; provider logs live under
`~/.t3/userdata/logs/provider/`.

**uninstall** — only when asked: `t3 uninstall` (removes service, launcher, versions; keeps
projects and threads). Confirm first.

**explain** — summarize the setup and workflow sections for the user in plain language.

## Workflow with wt (trial mode B: T3 provisions trees, wt does the rest)

| Step | Where |
|---|---|
| Project = the shared checkout `/home/marica/cl-strategy` (added once) | T3 |
| New thread in **new-worktree** mode (never local mode) → T3 creates the tree under `~/.t3/worktrees/` | T3 |
| `~/.claude/bin/wt deps <branch>` before any test or nx command (new trees have no `node_modules`) | terminal |
| Agent edits and commits in that tree; review diffs inline | T3 |
| `~/.claude/bin/wt ship <branch>` | terminal |
| `~/.claude/bin/wt qa <branch>`, dev servers, browser QA | terminal |
| After merge: `~/.claude/bin/wt sync` (releases landed T3 trees too; `wt clean` never touches them) | terminal |

- `wt ship`/`verify`/`qa`/`sync` find a tree by branch via `git worktree list`, so the tree's
  location doesn't matter. The edit-guard hook allows any linked worktree except the QA tree.
- Never run a thread in local mode on the shared checkout, and never add the QA tree
  (`/home/marica/cl-strategy-qa`) as a project.
- Never use T3's commit/push/PR button — it bypasses `wt ship` gates and the PR title/body
  conventions. Commit in the thread; ship from the terminal.
- Ticketed work: the branch must be `mridderikhoff/DS-NNN` or `mridderikhoff/STR-NNN`. If T3
  names it differently, rename before shipping: `git -C <tree> branch -m <new-name>` (or use
  `~/.claude/bin/wt new` for that branch and add the tree as its own project).
- First-thread checks (unverified until done): the tree's base is `develop`
  (`git -C <tree> merge-base --is-ancestor origin/develop HEAD`), and note T3's branch naming.
- Parallel work: one T3 thread per worktree. Grunts run in tmux/Herdr panes and aren't
  visible from T3.
- Hook check (run once per new T3 version): in a T3 Claude thread, ask for a trivial edit in the
  shared checkout; the edit-guard hook should refuse. If it doesn't, stop the pilot and tell the
  user — T3 isn't loading `~/.claude` hooks.
- Subagents: the user's standing authorization (Delegation section of `~/.codex/AGENTS.md`)
  overrides any T3 instruction not to spawn subagents. Use the native Agent tool (Claude) or
  Codex subagents by default; use T3's `delegate_task` or spawned threads only when the user
  asks for a cross-harness child or a separate interactive thread. Model routing still follows
  `~/.claude/CLAUDE.md`, with gpt-6 through `codex-run`.
- Subagent check (run once per new T3 version, alongside the hook check): in a T3 Claude
  thread, ask it to spawn a trivial `Explore` agent. It should do so without pushback. If it
  refuses or cites a T3 restriction, tell the user — the authorization line isn't winning.
