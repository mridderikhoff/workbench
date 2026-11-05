---
name: codex-computer-use
description: Ask Codex CLI (gpt-6-astra) to run local app verification that needs computer use, browser automation, simulators, screenshots, app launching, or independent runtime inspection.  This is how gpt-6 is invoked for computer-use work.  Use when the user asks Claude to have Codex or gpt-6 test a flow, verify UI behavior, inspect a running app, capture screenshots, or report confirmation and feedback about implemented behavior.
---

# Codex Computer Use

Use Codex as a separate local verification agent when the task needs real UI interaction, screenshots, simulator, browser, or device state, or an independent runtime check outside Claude's current context.

Do not use this for ordinary code reading, typechecking, linting, or tests Claude can run directly.

Launching apps, simulators, or browsers to verify the requested work is fine without asking. Ask first only if the run could disrupt the user's environment beyond that, such as closing their apps, changing system settings, or acting on real accounts or data.

## Workflow

1. Give Codex a self-contained prompt with the repo path, exact flow, constraints, artifact directory (`{{ARTIFACT_DIR}}`), and report format.
2. Delegate using the protocol below.
3. Read Codex's report, look at the screenshots, and summarize the result for the user.

## Delegation Protocol

Follow the protocol in `~/.claude/scripts/README.md`: one `codex-run` call, relay the artifact dir, arm the `codex-digest` Monitor, and read `report.md` when it finishes. Skill-specific parts:

```bash
~/.claude/scripts/codex-run --mode exec --label "<label>" --model gpt-6-astra --sandbox danger-full-access <<'PROMPT'
<self-contained prompt>
PROMPT
```

- **Model:** always `--model gpt-6-astra`. It's the computer-use model in the routing table, and the wrapper's default is sol.
- **Sandbox:** `danger-full-access` is needed for GUI automation, iOS simulators, launching desktop apps, screenshots, or access outside the repo. For non-GUI checks that only need the repo and the artifact directory, use `workspace-write`.
- **Target outside the current directory:** add `--cwd <dir>`, plus `-- --skip-git-repo-check` if that directory isn't a git repo.
- **Artifact dir in the prompt:** write `{{ARTIFACT_DIR}}`, so screenshots and logs land in the same folder as the report.
- **Bash description:** `Delegate to codex (gpt-6-astra): <label>`.

## Prompt Requirements

Tell Codex:

- The exact behavior to verify.
- The platform and app type, such as iOS, web, Electron, CLI, or desktop.
- Known launch commands, test credentials, seed data, deep links, or fixtures.
- Whether source edits are allowed. Default to no edits.
- Where screenshots, logs, and the final report should be saved.
- To return pass, fail, or blocked, plus the steps performed, the observed behavior, screenshot paths, and actionable feedback.

Keep the prompt specific enough that Codex does not need the surrounding Claude conversation.

## Example Prompt

```text
You are running a local verification pass for Claude. Do not edit source files.

Repository: /absolute/path/to/repo
Artifact directory: {{ARTIFACT_DIR}}
Platform: web app in Chrome, dev server already running at http://localhost:4200

Verify:
- Opening a translation row opens the editor dialog.
- The context column shows the base-locale value and the key path.
- Saving an edited value closes the dialog and the row shows the new value.
- Escape closes the dialog without saving.

Setup:
- Assume the dev server is already running. Do not start or restart it.
- If the app is not reachable, stop and report blocked.

Constraints:
- Read-only: no source edits, no commits, no package installs.
- Do not close or disturb the user's other windows or applications.

Artifacts:
- Save one screenshot per verified behavior to the artifact directory,
  named <step>-<result>.png.
- Save any console or network errors to {{ARTIFACT_DIR}}/console.log.

Report:
- Overall verdict: pass, fail, or blocked
- Per behavior: verdict, steps performed, observed behavior, screenshot path
- Console or runtime errors seen
- Actionable feedback on anything that works but feels wrong
```

## Reporting Back

- **Give a verdict per behavior,** and include the screenshot paths so the user can open them.
- **Look at the screenshots yourself** before repeating a pass claim. A screenshot that doesn't show the asserted behavior outranks Codex's text.
- **Separate what Codex confirmed from what it couldn't reach.**
- **If the verdict is blocked,** say what blocked it and what the user would need to provide, such as credentials, seed data, or a running server.

If `codex` is not installed (wrapper exit 127) or the run fails, report the error and offer to verify directly instead, for example with the `/playwright-cli` skill for browser work.
