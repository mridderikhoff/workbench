@~/.codex/AGENTS.md

## Claude Code only

- The main orchestrator runs on whichever of `opus` or `fable` I've selected; never
  change it. Sub-agent and Codex models follow the routing table in the codex-delegation
  block below.
- Reading the model a sub-agent ran on: the spinner line and the top banner show the *main
  thread's* model and effort (for example "Fable 5.1 with medium effort"), not the
  sub-agent's. The ground truth is the sub-agent transcript:
  `grep -o '"model":"[^"]*"' ~/.claude/projects/<project>/<session>/subagents/agent-<id>.jsonl`.
  Alternatively spawn a probe agent and ask it to quote the "You are powered by the model
  named …" sentence from its system prompt.
- Pick the narrowest agent type: `Explore` for read-only fan-out, stack and review
  specialists for their areas, and `general-purpose` only when nothing fits.
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
- **Searching files:** the main thread has no `Grep`/`Glob` (subagents do). Use `git grep`, or `grep -r`/`rg` scoped to a named subdirectory (`grep -r X apps/`); never rooted at the repo root (`grep -r X .`, path-less `grep -r X`, `cd dir && grep -r X .`) — those stop for approval, and a PreToolUse hook denies them. Delegate broad searches to an `Explore` agent (sonnet); keep conclusions and pointers, not raw output. Binds sub-agents — put it in every briefing.
- Use `session-handoff` before context reaches roughly 120k tokens.

<!-- codex-delegation:start (managed by simon/install-codex.mjs) -->
## Picking the right models for workflows and subagents

### Risk tiers
- Classify high-risk first; a change is trivial only when no high-risk condition applies.
- **Trivial**: config, copy, or under ~30 lines in one file. No cross-review; the orchestrator reads the diff.
- **Standard**: a normal feature or fix. One cross-review by the other model family.
- **High-risk**: auth, data migrations, public API, concurrency, or anything the user flags. Cross-review, then an Opus final gate.

Before a standard or high-risk implementation, make sure a baseline exists: a clean `git status`, or outside git (or with unrelated uncommitted changes) a snapshot copy of the files. After it, run the `cross-review` skill, whoever wrote the code.

### Routing (this table is the rule)
| role | model |
|------|-------|
| Plan/spec: standard | Opus (orchestrator) |
| Plan/spec: high-risk or ambiguous | Opus |
| Implement: bulk/mechanical (renames, codemods, migrations, boilerplate, data wrangling) | gpt-6-luna |
| Implement: clear spec, standard, not user-facing | gpt-6-sol |
| Implement: user-facing with a clear spec (UI tweaks, copy edits, docs, slides, spreadsheets), or trivial | Sonnet 5.5 |
| Implement: user-facing and exploratory or ambiguous (new UI direction, public API design), or gpt-6 failed twice on the task | Opus |
| Investigation: codebase search, Explore fan-out, "how does X work" | Sonnet 5.5 |
| Investigation: heavy data analysis or long unattended runs | gpt-6-sol (read-only `codex-run`) |
| Fix review findings | the original author (gpt-6 via `codex-run --resume`) |
| Review gpt-6 work: standard | a fresh Sonnet 5.5 subagent |
| Review gpt-6 work: high-risk | a fresh Opus subagent |
| Review Claude work | gpt-6-sol via `/codex-review` |
| High-risk final gate; taste review of substantial UI/copy | a fresh Opus subagent |
| Computer use | gpt-6-sol via `/codex-computer-use` |
| Codex wrapper in workflows | Sonnet 5.5, effort low |
| Never | Haiku |

Escalation has two ladders, and both stop at Opus: not user-facing goes gpt-6-luna → gpt-6-sol → Opus; user-facing or trivial goes Sonnet 5.5 → Opus. Sonnet does not sit between sol and Opus (same intelligence, so it would be a sideways step). If Opus still falls short, stop and ask me. You have standing permission to redo work one step up without asking when the output doesn't meet the bar. Judge the output, not the price tag.

Opus is the default orchestrator. When the session model is Sonnet 5.5, route anything high-risk or ambiguous to Opus planning instead of planning it yourself.

If computer use is helpful for completing or verifying work, use the `codex-computer-use` skill (gpt-6-sol).

### Scores (reference only; update the table above when these change)
Fable and gpt-6-astra are never routed to; the routing table above uses neither, even where a skill names them.

Higher is better on every axis, so a higher cost score means cheaper. Intelligence is how hard a problem you can hand the model unsupervised. Taste covers UI/UX, code quality, API design, and copy; the implementer of anything user-facing (UI, copy, public API design) needs taste >= 7, so it routes to Sonnet 5.5 when the spec is clear and to Opus when it is exploratory. In a mixed feature, Claude (per the table) takes the user-facing parts and gpt-6-sol the rest.

| model | cost | intelligence | taste |
|-------|------|--------------|-------|
| gpt-6-luna | 9 | 6 | 4 |
| gpt-6-sol | 8 | 7 | 5 |
| gpt-6-astra | 6 | 8 | 6 |
| sonnet-5.5 | 7 | 7 | 7 |
| opus-5.5 | 4 | 8 | 7 |
| fable-5-1 | 2 | 9 | 9 |

### Mechanics
- Claude models run via the Agent/Workflow `model` parameter. "Sonnet 5.5" in these rules means the `sonnet` alias; pin it with `ANTHROPIC_DEFAULT_SONNET_MODEL=claude-sonnet-5-5` in the `env` block of `~/.claude/settings.json`.
- gpt-6 runs only through the Codex CLI, and every launch goes through `~/.claude/scripts/codex-run` with an explicit `--model` (see `~/.claude/scripts/README.md`). Use the codex-implementation, codex-review, and codex-computer-use skills; for heavy data analysis or long unattended runs use `codex-run --mode exec --sandbox read-only --model <id>` with a self-contained prompt; for codebase investigation use an Agent with `model: 'sonnet'`.
- `codex-run` detaches and returns a banner naming the artifact dir. Arm a `Monitor` on `~/.claude/scripts/codex-digest <dir>` and relay each progress line to the user.
- In workflows, gpt-6 runs through a thin wrapper agent (`model: 'sonnet', effort: 'low'`) that writes a self-contained codex prompt, runs `codex-run --wait` with an explicit Bash timeout, and returns the report (use `schema` for structured output). Label it with the real model, e.g. `{label: 'gpt-6-sol:review-auth'}`, because the workflow UI only shows the wrapper's Claude model.
- Parallel gpt-6 implementation agents must use `isolation: 'worktree'` so codex edits don't collide.
- Workflow token budgets count only Claude tokens; codex work is invisible to `budget.spent()`.
<!-- codex-delegation:end -->
