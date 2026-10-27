# workbench — Agent Instructions

This repo is the live developer kit for both Claude Code and Codex: `~/.claude/bin`,
`~/.claude/scripts`, `~/.claude/hooks`, `~/.codex/hooks`, `~/.codex/hooks.json` and `~/.codex/bin/wt`
are symlinks into the main checkout at `~/workbench` (see `install.sh`). A change to shared behaviour
(worktree-only edits, QA rules) usually needs both the `hooks/` and `codex/hooks/` versions updated. Whatever is on `main`
there is what every agent session on the machine runs, so a half-finished edit in that checkout
breaks them all.

## Changing the kit

1. Never edit files in the main checkout. Provision a worktree on a branch:
   `WT_MAIN_CHECKOUT=~/workbench WT_BASE_BRANCH=main ~/.claude/bin/wt new <branch>`.
2. Edit and test there. The scripts have test switches, so nothing touches live services:
   - `wt`: `WT_STATE_DIR=<scratch> WT_DRY_RUN=1`, and `WT_MAIN_CHECKOUT` to point elsewhere.
   - `qa-stack`: `QA_UNIT_DIR=<scratch> QA_STACK_DRY_RUN=1`.
   - `kc-redirects`: `KC_LIB=<stub library>` with `WT_STATE_DIR=<scratch>`.
   - `qa-dashboard`: `--render-once --status-file <json>` renders without binding a port; the page
     accepts `?frame=`, `?theme=`, `?scheme=`, `?debug=1` and `?perf=1`.
   - Run `bash -n` on shell scripts and `python3 -m py_compile` on Python ones.
3. Commit on the branch, then fast-forward `main` in `~/workbench` (`git merge --ff-only <branch>`),
   or open a PR when the repo has a remote. Updating `main` is the deploy. Remove the worktree after.
4. After changing `qa-dashboard`, restart it: `systemctl --user restart cl-strategy-qa-dashboard.service`.
   After changing unit definitions in `qa-stack`, run `qa-stack install` and restart the affected unit.

## Rules

- Never start, stop or restart the shared backend or other agents' frontends while testing; use the
  dry-run and stub switches above.
- No secrets in the repo. Keycloak admin credentials stay in `~/.keycloak-local/config`, outside git.
- Any UI in this repo follows [DESIGN.md](DESIGN.md) and the playbook in [docs/STYLISED_UI.md](docs/STYLISED_UI.md): fun pixel-art visuals with plain wording,
  scannable status, accessible and fast. It ends with a prompt to hand agents for UI work.
- Keep personal defaults overridable by environment (`WT_MAIN_CHECKOUT`, `WT_TENANT`, `KC_LIB`, `QA_TREE`).
