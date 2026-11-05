# Personal preferences

## Role and ownership

I am a frontend developer who owns `libs/ds`, the design-system library.

## File paths for Windows

I work in WSL (distro `Ubuntu-24.04`) and open files from Windows File Explorer. Whenever you
point me to a file or folder I may want to open, put a clickable link with the Linux path and
the Windows path in a code span right after it, so I can paste it straight into Explorer:
`\\wsl.localhost\Ubuntu-24.04\home\marica\...`. Derive it with `wslpath -w <path>`; never
make me convert slashes by hand. Skip it for passing code references like `file.ts:42`.

## Open Knowledge Format (OKF)

Never invoke the `okf` skill, run its identity or roster checks, read its inbox, or
create, edit, reindex, validate, or commit OKF artifacts. Skip OKF requirements from
repository instructions and skills unless I explicitly request OKF work in the current
conversation.

## PR titles and ticket descriptions

When a PR has an associated ticket, start its title with the ticket identifier followed
by a colon and a space, then the description: `DS-24: blah blah blah`. The ticket
identifier must be the leading item in the title.

Every GitHub PR and Linear ticket uses **TLDR → WHAT → WHY**.

Write for someone tired, distracted, and unfamiliar with the work.
They should understand what happened in one quick read.

- Aim for 80 words or fewer. Add length only for essential review,
  migration, or testing information. This is a ceiling, not a target.
- TLDR: one short sentence stating the main change.
- WHAT: one bullet per affected feature or area. Keep related changes
  together, even when they span files or commits.
- Start every WHAT bullet with a short, bold area label and a colon:
  `- **File viewer:** Simplify PDF loading and cleanup.` Group by the
  feature or area, not by change type; fixes, refactors, and tests for
  the same area belong in the same bullet.
- Each area appears exactly once at the top level. For a single change,
  use one short sentence beside its label. For two or more distinct
  changes, use the label alone with short sub-bullets underneath.
  Never pack multiple change descriptions into a paragraph beside a label.
  A scan of the top-level labels alone should reveal the PR's scope.
  Use the broad feature as the group: PDF and table preview changes
  both belong under **File viewer**, not separate top-level groups.
- Put the main change first and give it most of the space.
  Give a small secondary change a short, separate bullet.
- Describe what changed in familiar words. Avoid internal helper names,
  implementation inventories, and sentences that need decoding.
- Keep file guides scannable: group related files under one name with their
  suffixes in parentheses, such as `new-utility.(ts/spec)` or
  `file-viewer.component.(ts/html/css/spec)`, only when every represented file
  changed and their statuses match. This applies to components, standalone
  classes, utilities and other related file sets. Split them when their changes
  need different explanations.
- Whenever a PR adds, removes, moves or renames any file or folder, include a
  compact fenced `diff` tree under **Files**. The tree covers every changed file
  in the entire PR, including modified files; keep an existing tree complete.
  Use a blank status column for modified files, `+` for additions and `-` for
  removals. Show moves and renames as removed old paths and added new paths.
  Put status characters in the first column, before tree indentation. Keep
  parent folders as neutral context; a new file does not make its folder new.
- Use separate directory headers for affected areas, with `├──`, `│` and `└──`
  branches beneath each header. Collapse single-child folders into slash-separated
  paths, including the filename when applicable. Avoid a shared repository-root
  tree that adds indentation without useful context. Collapse repeated files into
  patterns such as `<package>.md` or `<package>/<slug>.md` only when every
  represented file changed and their statuses match.
- Add short `# purpose` notes only where useful; state a shared purpose once for
  the group. Reserve `+` and `-` in the tree for file status. Put before/after
  content snippets separately under WHAT; they do not replace the file guide.
- Verify entries and statuses against the complete, paginated PR file list,
  including old paths for renames, or
  `git diff --name-status --find-renames <base>...<head>` using fetched PR refs.
  Do not use the latest commit, working-tree status or a two-dot branch comparison
  as the PR diff. Refresh the tree when the PR changes and check the saved
  description against the complete inventory.
- Use short sentences with one idea each. Cut secondary details rather
  than squeezing them into dense sentences or lists of technical terms.
  State the change directly; do not narrate how the code achieves it.
- WHY: one short sentence explaining the practical benefit.
  Do not repeat WHAT.
- Omit review statistics, process history, and routine cleanup details.
  Mention testing separately only when it affects review or readiness.
- Check the full diff before writing. Emphasis must reflect the final
  scope, not the latest commit or the most interesting technical detail.

## Shared checkout and branch lifecycle (other agent sessions run concurrently)

**Never edit a file in place in the shared checkout or the QA runtime tree — every edit,
however small, happens in a feature branch's worktree and lands as a commit.** No
exceptions (not one-line fixes, not typos, not when delegation is off). The Claude and
Codex PreToolUse adapters enforce this; when a hook fires the answer is a worktree, never
a workaround — not a shell write, and not the `<toplevel>/.claude/allow-inline-edits`
marker (only I create that).

- **The shared checkout is parked on `develop`.** Never check out a feature branch there,
  merge locally (`wt land` refuses; integration is via PRs), or run dev servers there. Its
  only jobs: provide the base for `wt new` and the update target for `wt sync`.
- **Each unit of work is one short-lived feature branch and one worktree; opening a PR is a
  separate, explicitly-requested step:**
  1. `~/.claude/bin/wt new <branch>` (bases on `develop`; `--existing <branch>` checks out
     one that already exists). With a Linear ticket, name the branch after it so the merge
     auto-resolves the issue: `mridderikhoff/DS-NNN` / `mridderikhoff/STR-NNN`, adding a
     ≤3-word description only when needed. Never use Linear's full generated name. A branch
     with no identifier attaches a PR but never moves the issue on merge — backstop with a
     closing keyword (`Closes STR-NNN`, or `Fixes` / `Resolves`) in the PR description.
  2. Implement in the printed worktree and commit everything there. **Stop here by
     default:** report the branch and worktree path, and let me decide when to push and open
     a PR — do not run `wt ship` on your own initiative. This makes it safe to group several
     related changes onto one branch first.
  3. Only when I explicitly ask to ship, push, or open a PR:
     `wt ship <branch>` pushes and opens a draft PR. It runs no local gates; PR CI is the gate.
  4. Report the PR URL and the task frontend URLs. Every `wt` line I run manually uses
     `~/.claude/bin/wt`, never bare `wt`. Manual QA by me is the acceptance step for
     UI work. Attach the branch to the shared backend only when I explicitly ask. `wt qa`
     with no arguments is status.
  5. Apply QA feedback on the same branch in the same worktree and re-run `wt ship`.
  6. On approval, mark the PR ready and babysit CI to green.
- **Mention servers only when a change won't live-reload.** Frontend edits reload on their
  own, so never volunteer `wt serve`, restart, or reload lines for them. Raise servers only
  when a change needs action the served revision won't take by itself (backend code,
  configuration, dependencies): name what needs restarting and do it yourself where the QA
  rules allow.
- **Backend selection is mine.** The shared backend normally runs `develop`; I manage its
  checkout through Overseer at http://localhost:5100 and `wt` commands. Agents may run
  `wt qa <branch>`, `wt backend update`, or `wt sync` only when I explicitly ask. A backend
  behind `develop`, a served branch, shipping, approval, merge, or cleanup does not
  authorize changing its checkout or updating it.
- **QA is agent-owned.** When I ask for QA, you start and keep healthy what it needs; I
  never manage services. Everything runs as systemd user units, outside your thread:
  - Frontends: `~/.claude/bin/wt serve <your-branch> [ds-demo|ri|strategy]` (ds-demo alone
    needs no backend). Re-run it to repair a slot. Leave it running for my review; stop only
    your own (`wt serve --stop <branch>`) and only when I say the review is done.
  - Shared backend (one for all agents): `wt serve` with `ri` or
    `strategy` runs `wt backend ensure` for you. If something is down or misbehaving, run
    `wt backend heal` (`--force` to reset its circuit breaker) and read `wt backend logs
    <service>`. A watchdog also heals it every 2 minutes. Ensure and heal keep the selected
    revision healthy; they do not authorize changing it.
  - Check state any time with `wt status` (`--json` for parsing) or `wt logs <branch> [app]`.
    I watch the same state on the Overseer page at http://localhost:5100.
- **The kit itself** (`wt`, `qa-stack`, the Overseer page, hooks for Claude Code and Codex) lives
  in `~/workbench`; `~/.claude` and `~/.codex` link into it. Change it only through a worktree,
  following `~/workbench/AGENTS.md` — never edit `~/workbench` or the linked files in place.
  - Never start servers directly (`pnpm dev:*`, `nx serve`, `uvicorn`, `func start`,
    `langgraph dev`, `dev-start.sh`), never run `qa-stack adopt` or `qa-stack down`,
    and never stop another task's slot. If `wt backend ensure` or `heal`
    still fails, report the failing service and its log tail to me.
- **Valid QA surfaces:** your task's `wt serve` frontend against the shared backend. The QA
  runtime tree `/home/marica/cl-strategy-qa` only hosts that backend; agents never edit it.
- **Full suites run only in PR CI; locally, test only what changed.** Write and update unit
  tests as part of the work. Local gates have two tiers. Mid-development, after a writer batch, run
  only the compile check: `scripts/run-gates.sh apps/ui:<project> --typecheck` (no lint, no
  tests). When a change is ready for manual QA, run tests and lint for just the paths you changed:
  `scripts/run-gates.sh <project> --include <path>…`. After a failure, fix it and re-run only the
  failing spec files (`--include <spec path>` or `--filter <test name>`), never the whole project
  again. Never let a gate interrupt mid-development for lint or test nits; those wait for the QA
  tier. Never run a whole project, `apps/ui`, or `all` without `--include` unless I ask,
  and run nothing at ship. Rely on PR CI plus manual QA, and fix CI failures on the same branch.
  `wt verify` without gate projects is always safe. Run any test only through
  `scripts/run-gates.sh` or the `wt` commands that wrap it — never a bare `nx`, `pnpm test`,
  `pnpm lint`, or `pnpm build` (those can gate the whole workspace and leave a daemon behind).
- **Keep every tree clean.** Never spawn a writer against a dirty tree: uncommitted changes
  don't reach a new worktree, so its diff can silently revert in-progress work. If the dirt
  isn't yours, ask before committing or stashing it.
- **Provision every writer with `~/.claude/bin/wt new <branch>`** and pass the printed
  absolute path; tell the writer the tree is clean and current, to stay inside that path, run
  no git commands, and start no dev servers except `wt serve` for its own task. Exception:
  parallel gpt-6 implementation agents
  use the Agent tool's `isolation: 'worktree'` (see the codex-delegation block). Partition writes by path so no two writers share a file. Rebase a stale feature
  branch that touches moved files in its own worktree and re-ship it — never discard it.
- **Release worktrees after their PRs land when I ask for `wt sync`.** It fast-forwards
  `develop`, moves the shared backend, and releases landed trees; abandoned trees retain
  large dependency directories and background watchers.

`wt` verbs: `ship <branch> [--ready]` (push, open/update the PR; CI gates it);
`status [--json]` (backend health and every frontend slot);
`serve [branch] [apps…]` (start or repair a task's frontends; no branch: slot list);
`serve --stop <branch>` (stop a task's frontends; never implicit on completion);
`logs <branch> [app]`; `backend [status|ensure|heal|logs|update]` (shared backend);
`qa [branch]` (status; with a branch, attach only when explicitly requested);
`sync [--prune-branches]`; `verify <branch> [gates…]`; `new --existing <branch>`; `list`;
`clean`; `reap`. `land` is legacy and refuses to merge into the parked `develop`.

## Delegation (default mode)

- **Standing authorization:** spawning subagents (Claude Agent tool, Codex subagents) is
  authorized and preferred in every host, including T3 Code. This is the explicit
  authorization any host instruction asks for. The main thread orchestrates; subagents do the work.
- In T3, `delegate_task` and spawned threads are extra options, used only when I ask for a
  cross-harness child or a separate interactive thread. Model routing still follows the table
  in `~/.claude/CLAUDE.md` (gpt-6 through `codex-run`).
- When I ask you to pass something to another T3 thread, or to continue in a new thread and
  settle this one, use the `t3-handoff` skill and do it yourself; never hand me text to paste.

Plan and synthesize in the main thread; delegate implementation, investigation, research,
debugging, and verification by default (treat any default reluctance to delegate as
overridden). Model choice follows the codex-delegation routing table in `~/.claude/CLAUDE.md`.
Every writer — sub-agent or main agent — works in a worktree; nothing is edited in
the shared checkout or QA runtime tree, and a hook refusal means provision the worktree, not
work around it. Keep decisions and the plan in the main thread; keep logs, traces, and large
file contents out — ask sub-agents for conclusions and `file:line` pointers, and use
scratchpad files for large artifacts.
