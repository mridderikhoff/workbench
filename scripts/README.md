# ~/.claude/scripts

Delegation to the Codex CLI. Every codex launch goes through `codex-run`.
Models: `gpt-6-luna` for fast, cheap bulk and mechanical work; `gpt-6-sol` for
standard implementation, fix runs, and reviews; `gpt-6-astra` for computer use
and high-risk reviews. The wrapper defaults to `gpt-6-sol` and does not read
`~/.codex/config.toml` for the model.

| script | purpose |
|--------|---------|
| `codex-run` | Makes the artifact dir, saves the prompt, prints the banner, starts `codex exec`/`codex review` detached, and returns in about a second. With `--wait`, it blocks and exits with codex's exit code. |
| `codex-digest` | Command for the `Monitor` tool. For exec runs, it prints a line at once on first action, on errors, on failed commands, and when codex finishes, plus a progress line every 5 min. After 10 min with no new event it prints `⚠ codex stalled` with the kill command (`--stall <s>` tunes it, `--stall-kill` sends SIGTERM itself). For review runs, it prints only the finish line. It stops at 29 min (re-arm it). |

Artifact dir (`$TMPDIR/codex-<label>.XXXXXX/`): `prompt.md`, `meta.json` (with the
codex pid), `events.jsonl` (exec only), `report.md`, `stderr.log`, `exit-code`, and
`run.log` (the finish line of a detached run). Where the prompt must name the artifact
dir, write `{{ARTIFACT_DIR}}`. `codex-run` puts the real path in its place.

Exec runs get a sandbox preamble at the top of `prompt.md`, chosen by `--sandbox`:
read-only tells codex that nx, tsc, vitest/jest and biome --write fail with EPERM, so it
must read code only and not attempt workarounds; workspace-write tells it that the
network is off (port binds fail with `listen EPERM`), to report that rather than rewrite
tests, to keep scratch files in the artifact dir, and to keep existing tests when editing
specs. Prompts no longer need to repeat these rules.

## Delegation protocol

1. Tell the user in one line what you are delegating.
2. Make ONE ordinary Bash call with the description `Delegate to codex (<model>): <label>`:
   ```bash
   ~/.claude/scripts/codex-run --mode exec --label "<label>" --sandbox workspace-write <<'PROMPT'
   <self-contained prompt>
   PROMPT
   ```
   Options: `--mode review -- --uncommitted | --base <branch> | --commit <sha>`,
   `--sandbox read-only | danger-full-access`, `--cwd <dir>`,
   `--model <id>`, `--resume <artifact-dir>` (exec only; inherits its sandbox,
   cwd, and model unless flags override them), `--wait`,
   `-- --skip-git-repo-check`.
3. The tool result is the banner (`▶ Delegating to codex (...) · <label> · artifacts: <dir>`)
   and a `progress:` line. Relay the artifact dir to the user.
4. Arm `Monitor` with the command `~/.claude/scripts/codex-digest <dir>`,
   `timeout_ms: 1800000`, and the description `codex progress: <label>`. Relay each
   progress notification in one sentence. If it says `digest expiring`, re-arm it.
   If it says `⚠ codex stalled`, run the kill command it names, then relaunch with a
   tighter prompt (smaller target, fewer files). Two stalls in a row on the same target
   means the run is too big: split it or do the work directly.
   Review runs get no progress lines, only the finish line. Arm the Monitor for them
   anyway, because it is the only signal that the run finished.
5. On `■ codex finished`, read `report.md`. If the line names `stderr:` or says
   `⚠ report empty`, also read `stderr.log`. `exited without writing exit-code`
   means the run died; read `stderr.log` and `run.log`.
6. Exit 127 means `codex` is not on PATH. Report this and offer to do the work directly.

Workflow wrapper subagents use `codex-run --wait` with an explicit Bash `timeout`
(10 min at most). Their final report is enough, so they do not need to arm a
digest. For runs that can take longer than 10 min, use the default detach and
arm the digest.

## Notes

- Fix runs: to have codex fix review findings on its own earlier run, use
  `--resume <original artifact dir>` with the findings as the prompt. Arm the
  digest on the new artifact dir. Extra codex args are inherited unless new
  `--` args are given; model flags and exec-only flags that `exec resume`
  rejects (`-C`, `-s`, `--add-dir`, `-p`, `--oss`, ...) are dropped.
- `codex review` 0.155.1 will not take a custom prompt together with
  `--uncommitted`, `--base`, or `--commit`. For this reason `codex-run` removes
  those flags, writes the review target at the top of `prompt.md`, and then runs
  a prompt-only review.
- If codex gets SIGTERM, a shell command that it started can continue to run.
