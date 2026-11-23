@~/.codex/AGENTS.md

## Claude Code only

- Keep the main orchestrator on the model I selected; never silently change it.
  Sub-agent and Codex models follow the routing table in the codex-delegation block below.
- Reading the model a sub-agent ran on: the spinner line and the top banner show the *main
  thread's* model and effort, not the
  sub-agent's. The ground truth is the sub-agent transcript:
  `grep -o '"model":"[^"]*"' ~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`.
  Alternatively spawn a probe agent and ask it to quote the "You are powered by the model
  named …" sentence from its system prompt.
- Pick the narrowest agent type. Use read-only Codex Sol for investigation by default;
  use Claude `Explore` for a Claude-specific dependency. Use review specialists for
  their areas and `general-purpose` only when nothing fits.
- Never fork — always brief a fresh sub-agent instead (forking carries the full
  conversation and dodges the sub-agent model enforcement; it's also disabled via
  `CLAUDE_CODE_FORK_MODE`). Load `orchestrate` for long multi-phase work.

## Servers and QA

- QA is agent-owned per the imported `~/.codex/AGENTS.md`: agents run `wt serve`,
  `wt status`, `wt logs` and `wt backend ensure|heal|logs` to keep the selected revision
  healthy. The shared backend normally runs `develop`. Changing its checkout with
  `wt qa <branch>`, updating it with `wt backend update`, or running `wt sync` requires
  my explicit request. Direct server starts and `qa-stack adopt|down` remain prohibited.

## Turn economy

- Look, don't guess. Verify before stating a fact; if you can't, say "unverified".

- Batch independent tool calls into one message and chain related shell facts.
- **Searching files:** the main thread has no `Grep`/`Glob` (subagents do). Use `git grep`, or `grep -r`/`rg` scoped to a named subdirectory (`grep -r X apps/`); never rooted at the repo root (`grep -r X .`, path-less `grep -r X`, `cd dir && grep -r X .`) — those stop for approval, and a PreToolUse hook denies them. Delegate broad searches to a read-only Codex Sol agent by default; use Sonnet Explore when a Claude-specific tool dependency makes that useful. Keep conclusions and pointers, not raw output. Binds sub-agents — put it in every briefing.
- Use `session-handoff` before context reaches roughly 120k tokens.

<!-- codex-delegation:start (managed by simon/install-codex.mjs) -->
## Picking the right models for workflows and subagents

### Risk tiers and review coverage
- Classify high-risk first; a change is trivial only when no high-risk condition applies.
- **Trivial**: config, copy, or under ~30 lines in one file. No cross-review; the orchestrator reads the diff.
- **Standard**: a normal feature or fix. One independent cross-review by the other model family.
- **High-risk**: auth, data migrations, public API, concurrency, or anything the user flags. Cross-review, then a separate independent Opus final gate.

Before a standard or high-risk implementation, make sure a baseline exists: a clean `git status`, or outside git (or with unrelated uncommitted changes) a snapshot copy of the files. After it, apply the `cross-review` skill, whoever wrote the code. Reuse an equivalent independent cross-review already completed by `ds-craft`; do not stack a duplicate standard review.

### Routing (this table is the rule)
| role | model |
|------|-------|
| Plan/spec and coordination: standard | selected Codex or Sonnet coordinator |
| Plan/spec: high-risk or ambiguous design | Opus for a bounded plan or decision |
| Implement: bulk/mechanical (renames, codemods, migrations, boilerplate, data wrangling) | gpt-6-luna |
| Implement: clear spec, including agreed UI, copy, docs, tests, and routine fixes | gpt-6-sol |
| Implement: exploratory or ambiguous design (new UI direction, public API design) | Opus decides direction; gpt-6-sol implements the agreed spec |
| Investigation: codebase search, analysis, "how does X work" | gpt-6-sol, read-only by default |
| Investigation: Claude-specific dependency that benefits from Claude tools | Sonnet |
| Fix review findings | the original author (gpt-6 via `codex-run --resume`) |
| Review gpt-6 work: standard | a fresh Sonnet subagent |
| Review gpt-6 work: high-risk | a fresh Opus subagent |
| Review Claude work | gpt-6-sol via `/codex-review` |
| High-risk final gate | a fresh independent Opus subagent, separate from cross-review |
| Taste judgment for substantial new UI, flows, or public copy | Opus; combine with a qualified required review when possible |
| Computer use | gpt-6-sol via `/codex-computer-use` |
| Codex CLI wrapper in Claude workflows | Sonnet, effort low |
| Never | Haiku |

Judge the output and task risk. If a delegated run falls short, narrow the task or clarify the spec. After two Sol attempts fail on the same task, obtain a bounded Opus diagnosis or replan. If that still cannot meet the bar, report the blocker and ask for the user's decision. Keep the selected main model unchanged. A standard coordinator does not default to Opus.

If computer use is helpful for completing or verifying work, use the `codex-computer-use` skill (gpt-6-sol).

### Allowance-aware assignments

At a meaningful phase or assignment boundary, use an available recent quota snapshot or
the user's report once; do not poll. If Claude is at least 80% used in a short window,
or the user reports pressure, shift eligible execution, investigation, and verification
to Codex when it has headroom. Keep Claude's required design judgment and independent
review narrowly scoped. Do not infer percentages from raw token totals or compare
different windows as equal. Missing snapshots do not block routine work: note that
allowance is unknown. Do not change the selected main model, account, or API settings.
At exhaustion, continue independent eligible work and report any deferred required
gate; never silently bypass independence or review. Report who did the work and checks,
plus quota snapshots only when actually available.

### Mechanics
- Claude models run via the Agent/Workflow `model` parameter. "Sonnet 5.5" in these rules means the `sonnet` alias; pin it with `ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-5-5` in the `env` block of `~/.claude/settings.json`.
- In Claude Code, launch gpt-6 through `~/.claude/scripts/codex-run` with an explicit `--model` (see `~/.claude/scripts/README.md`) and the matching implementation, review, or computer-use skill. Investigations use read-only mode by default. In T3 or another Codex host, use its native agent/delegation tools according to host rules; do not route back through the Claude CLI wrapper merely to run Codex.
- In a Claude host where detached `codex-run` does not wake the turn on completion, arm a `Monitor` on `~/.claude/scripts/codex-digest <dir>`. If the host already supplies completion notifications, use them instead. In T3 Code, also call `t3_background_wait` with the Monitor's task ID before ending the turn, and again after each re-arm, or T3 shows the thread as done.
- In workflows, gpt-6 runs through a thin wrapper agent (`model: 'sonnet', effort: 'low'`) that writes a self-contained codex prompt, runs `codex-run --wait` with an explicit Bash timeout, and returns the report (use `schema` for structured output). Label it with the real model, e.g. `{label: 'gpt-6-sol:review-auth'}`, because the workflow UI only shows the wrapper's Claude model.
- Parallel gpt-6 implementation agents must use `isolation: 'worktree'` so codex edits don't collide.
- Workflow token budgets count only Claude tokens; codex work is invisible to `budget.spent()`.
<!-- codex-delegation:end -->
