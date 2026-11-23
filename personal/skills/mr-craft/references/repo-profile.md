# Repository profile

Resolve this profile before any reviewer or writer starts. Write it to
`<run dir>/repo-profile.md` and pass its absolute path in every briefing. Inspect the
target worktree, not another checkout. Record paths as absolute paths and name the
source of each rule or command. Never guess a missing role or command.

## Discover the repository

1. Find the worktree root with `git rev-parse --show-toplevel`. Use that root for all
   paths. A task without a worktree needs one before writing, as the host's worktree
   instructions require.
2. Inventory Angular and TypeScript projects from `angular.json`, `project.json` and
   `nx.json`, workspace `package.json` files, and `tsconfig*.json`. Include projects
   with Angular sources, TypeScript sources, or a TypeScript configuration. Record each
   supported project's root, project name if declared, and the file that established it.
   Exclude generated output and dependencies. A target outside these projects is not
   supported; ask for a valid target.
3. Find the test stack from package dependencies, project configuration, and existing
   specs. Record Karma/Jasmine, Jest, or Vitest, and Spectator or TestBed where used.
   Record `none` when there is no evidence. Do not assume that all projects share a stack.

## Gates

Find commands in this order: the command section in the applicable `AGENTS.md` or
`CLAUDE.md`, `scripts/run-gates.sh`, then `package.json` scripts. The nearest applicable
instructions win when commands conflict. Record the exact project and path placeholders,
working directory, and source for each usable command. A command is *scoped* only when it
can target the affected project and changed paths or specs without running a full suite.

| Tier | When | Command to record |
| --- | --- | --- |
| Typecheck | Build: after each writer batch | Typecheck only for each affected project. |
| Scoped tests and lint | Build: before the manual QA checkpoint; refine: after each writer batch | Tests and lint scoped to changed paths for each affected project. |
| Retry | After a failure | Only the failing spec file, with a test filter if supported. |

Writers write and update unit tests. Never run a full suite unless the user asks.
Reviewers and report mode run no gates. If a scoped command is unavailable, write
`none — ask before broader execution` for that tier. A tool named `run-gates.sh` is
not evidence of an option it does not implement; inspect its interface first.

## Rule roles

Search `.claude/skills/*/SKILL.md`, `.agents/skills/**`, and applicable
`AGENTS.md`/`CLAUDE.md`. Record a role as a path plus relevant section names, or
`none`. A role may cite more than one source. Do not import a rule from a different
repository. Record these roles:

| Role | Source to look for |
| --- | --- |
| `angular` | The repository's Angular skill and conventions. |
| `scss` | Sass and CSS conventions. |
| `i18n` | Translation and user-visible string rules. |
| `comments` | Comment and documentation conventions. |
| `component-library` | The repository's component skill, catalog, and public use rules. |
| `conventions` | Non-obvious instructions such as import proxies, class prefixes, and package manager choices. |

Also record any visual-design skill as an optional source for visual work. Read the
role sources that apply to the task. Packet citations use these role names; the
fallback for absent roles and sections is in `schema.md`.

## Run directory and repository skill

Run `git check-ignore -q .scratch` at the root. On success, use
`<root>/.scratch/findings/mr-craft/<run>/`. Otherwise use
`${XDG_STATE_HOME:-$HOME/.local/state}/mr-craft/<repo-name>/<run>/`. Choose a unique,
stable run name for this pass and create the directory before report skeletons.
Record the chosen absolute path. Do not place findings in an unignored `.scratch`.

Search the repository skill directories for its own craft skill. Record its invocation
name and path, or `none`. If it has a `*-contract` packet, record each packet name and
path. Published component contracts are outside portable `mr-craft` review; the repo
skill can cover them in a separate report.

## Profile record

Use this shape so a writer or reviewer can inspect the profile quickly:

```md
# Craft repository profile
- Root: <absolute git toplevel>
- Run directory: <absolute path>
- Targets: <project, root, discovery source per line>
- Gates: typecheck <command or none>; QA <command or none>; retry <command or none>
- Test stack: <per-project evidence>
- Rule roles: angular <path and section or none>; scss ...; i18n ...;
  comments ...; component-library ...; conventions ...
- Visual-design skill: <path or none>
- Repository craft skill: <name and path or none>
- Contract packets: <names and paths or none>
```
