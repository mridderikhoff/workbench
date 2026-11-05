# Personal setup

This is Marica's versioned agent setup. Overseer users do not need it. The default installer
never installs these files; `./install.sh --personal --dry-run` previews adoption and
`./install.sh --personal` installs it alongside the runtime. Python 3.11+ is required for this
profile (the macOS runtime already requires 3.13+).

## What is versioned

| Source | Installed destination |
| --- | --- |
| `prompts/AGENTS.md` | `~/.codex/AGENTS.md`, shared user instructions |
| `prompts/CLAUDE.md` | `~/.claude/CLAUDE.md`, imports the shared instructions and adds Claude guidance |
| `skills/<name>/` | Clients listed in `skills.json`; each skill has one canonical source |
| `hooks/`, `scripts/` | Individual links under `~/.claude/hooks/` and `~/.claude/scripts/` |
| `codex/` | Codex hooks and Herdr bridge under `~/.codex/` |
| `config/claude-settings.json` | Merged into `~/.claude/settings.json` |
| `config/codex-config.toml` | Managed scalar preferences merged into `~/.codex/config.toml` |
| `config/statusline-v2.mjs` | `~/.claude/statusline-v2.mjs` |

The root repository prompts remain instructions for developing workbench. They are not installed
as global defaults. The personal base prompts were imported from the existing user files without
rewriting their content.

## Editing and installing

Edit linked prompts, skills and scripts through a feature worktree, then commit them. Installing
from that worktree points the links there, so use a durable checkout when adopting the finished
change. Settings are rendered and merged, rather than linked: edit their templates here and rerun
the personal install to apply changes. `${HOME}` in command templates is rendered for the target
home; `OVERSEER_INSTALL_HOME=/absolute/scratch/home` provides an isolated test destination.

The installer backs up every replaced file, directory or dangling link as `.bak-<timestamp>`.
Merged settings retain existing file permissions; new settings files are private to the user.
Repeated installs leave already-correct links and settings alone. Settings keys owned by the
profile take precedence, including permissions, model preferences and hook arrays. Existing
unowned JSON keys, environment values, Codex MCP servers and project trust entries survive.
Malformed or unsupported settings stop the personal install before any personal file is changed;
the runtime tool links may already have been installed.

Plugin enablement is a declaration; the installer does not download plugins. Credentials,
MCP authentication, local server declarations, checkout trust, session state, command-approval
history, managed organization policy and caches are deliberately not imported. Existing local
values survive a settings merge. No services are started or restarted by this installer.

The old top-level `hooks/` and `codex/` directories and personal `scripts/` files remain compatibility
symlinks. Existing home links therefore continue to work before the installer is rerun after deployment.
New installs link straight into `personal/`. The previously versioned `skills/explain/` and
`skills/learn-by-teaching/` paths also remain compatibility links to their canonical personal copies.

## Skill provenance and dependencies

`skills.json` records each imported skill's source location and client destinations. The shared
Claude, Codex and agent copies are deduplicated. Use `orchestrate` for coordinated work.
Claude-specific Codex wrappers and review skills stay Claude-only. No user-level agent definitions
were present at import time; future definitions can be added under `agents/claude/`, `agents/codex/`
or `agents/agents/` and will be linked individually by the personal installer.

`ds-design` is a snapshot of the user's maintained skill from the cl-strategy DS kit. Its referenced
DS kit and repository remain external dependencies. Updating that source requires intentionally
refreshing this snapshot; installing workbench does not copy the DS kit itself.

`dependencies.json` records the existing third-party skill sources and upstream skill-folder hashes:

- Herdr: `ogulcancelik/herdr`, root `SKILL.md`.


These are provenance hashes from the existing skill lock, not Git commit pins. Install these using
their upstream instructions if needed; this installer never fetches dependencies or vendors the
Herdr repository. Existing installations are left alone. Plugin/system skills, synced cloud skills,
trash, generated files and credentials are excluded. The two configured Claude plugins are declared
in `config/claude-settings.json`; they still need the corresponding marketplaces and authentication.

## Verification

Run `scripts/run-gates.sh installer` for focused sandbox checks. They cover both profiles, settings
preservation, client mappings, repeated installs, backup handling and write-free dry runs. Tests
never install into the real home or touch running services.

## Borrowed Claude/Codex workflow

The hybrid workflow comes from [Simon’s setup in claude-and-cursor-profile](https://github.com/copperleaftech/claude-and-cursor-profile/tree/main/simon).
It includes `codex-implementation`, `codex-review`, `codex-computer-use`, `cross-review`, the
`codex-run` and `codex-digest` scripts, their README, and the delegation block in the Claude
base prompt. These are retained as locally adapted copies. Upstream paths are recorded in
`skills.json` and `dependencies.json`. The original import revision is unknown; the files
are not claimed to match upstream main exactly. Local routing and script changes remain local.

## Retired skills

`manager-mode`, `pr-backend-review-artifact`, `find-skills` and `skill-harden` are retired.
The personal installer moves existing copies or aliases in Claude, Codex and agent skill folders
to `~/.local/state/workbench/retired-skills/<client>/<name>.bak-<timestamp>` and stops installing
them. Archives stay outside skill discovery folders so retired skills cannot load accidentally.
The installer never deletes their contents.
The runtime-only installer leaves them alone. `retired-skills.json` records this migration;
`dependencies.json` preserves the former find-skills provenance. For coordinated work, use
`orchestrate` directly. These retirements do not change the Claude/Codex hybrid workflow.
