---
name: cross-review
description: Run the cross-model review loop after an implementation. It picks the reviewer by risk tier, runs verification, gets an independent review from the other model family (a fresh Sonnet 5.5 subagent for standard gpt-6 work, Opus for high-risk, gpt-6 via codex-review for Claude work), triages the findings, sends fixes back to the author, and stops after two rounds. Use after any standard or high-risk implementation, whoever wrote it, or when the user asks for a cross-review or a second-model review.
---

# Cross Review

The reviewer always comes from the other model family. gpt-6 work gets a Claude review, and Claude work gets a gpt-6 review. The orchestrator verifies, triages, and reports, and it does not review its own spec. Tiers and models come from the routing table in `~/.claude/CLAUDE.md`.

## 1. Classify the tier

State the tier in one line so the user can override it.

- **Trivial**: read the diff yourself and stop here.
- **Standard**: one cross-review, and re-reviews per step 7.
- **High-risk**: a cross-review, then a separate independent Opus gate (step 8).

## 2. Build the review packet

Write these files to the scratchpad for each review packet:

- `criteria.md`: the acceptance criteria and constraints, with no conversation history and no implementation prompt.
- `change.diff`: every change since the baseline, covering staged, unstaged, and untracked files (`git diff HEAD` alone misses new files). Outside git, diff against the baseline snapshot that `CLAUDE.md` requires before implementation starts.
- `verification.md`: the output of step 3.

For packets with the same scope and author family, give one reviewer all checklists and
packets. Retain a separate report and evidence for each packet. This personal trial
overrides a repository skill's reviewer-per-packet or reviewer-per-section default,
including `ds-craft`. Do not create nested reviewer fan-out unless the user asks or
genuinely different scopes need it. Use the strongest qualified reviewer required by
the combined scope and keep it independent of every author. Reuse equivalent completed
independent cross-review coverage instead of adding a duplicate standard review.

For mixed Claude/Codex authorship, partition coverage by author family: Codex reviews
Claude-authored scope, and Claude reviews Codex-authored scope. Give both reviewers
the combined diff and affected context to check integration, retain each report, and
keep the separate high-risk final gate.

## 3. Verify once

The orchestrator runs the cheapest reliable checks (typecheck, focused tests, a real run of the changed path) and saves the output. Reviewers read this output and don't repeat the checks.

If a check fails because of the implementation, send it back to the author first. That doesn't count as a review round.

## 4. Get the cross-review

**If gpt-6 wrote the code**, spawn a fresh subagent: `Agent` with `model: "sonnet"` (standard) or `model: "opus"` (high-risk) and `subagent_type: "general-purpose"`. Its prompt contains:

- the paths of the three packet files, and nothing from the conversation
- "Do not edit files. Do not re-run verification. You may build scratch reproductions to test a hypothesis."
- "Also judge whether the requirements themselves have gaps that the implementation exposes."
- The output format: findings most severe first, each with severity, file:line, a concrete failure scenario, a fix direction, and whether it is CONFIRMED (reproduced) or PLAUSIBLE. Then a one-line-each list of what was checked and found fine, in under ~500 words.

**If Claude wrote the code**, use the codex-review skill with `--mode exec --sandbox read-only` and `--model gpt-6-sol`. Put `criteria.md` and `verification.md` in the prompt, name the diff file or target, and ask for the same output format.

## 5. Triage

Check every finding against the code, and reproduce it when that's cheap. Sort each one as **confirmed**, **rejected** (with a one-line reason), or **unverified**. Show the user a table of all three, including the rejected ones, so they can overrule a dismissal.

## 6. Fix

The original author fixes the confirmed findings.

- **For gpt-6 in Claude Code**, use `codex-run --resume <original artifact dir> --model <same model>`, with the findings and the verification they need as the prompt. Arm the digest only if the host needs it to wake on completion. In another host, use native continuation tools.
- **For Claude**, the orchestrator fixes directly only if it wrote the code; otherwise it sends the findings back to the implementing subagent with `SendMessage`.

Before the fix, snapshot the files so the fix diff can be reviewed on its own. Then re-run the step 3 checks.

## 7. Re-review (bounded)

Re-review only if the fixes are substantial (they add logic or change behavior), or if the tier is high-risk. Trivial corrections need no new review. Use a **fresh** reviewer from the same family as in step 4, give it the fix diff plus affected context, and ask for regressions and edge cases. The first required review must cover the full change; never narrow it to the fix diff.

**Round 2 is the last review round.** If required findings remain, report the unresolved
gate and continue eligible independent work. Do not silently ship or bypass it.

## 8. Final gates

- **High-risk work**: spawn a fresh independent Opus agent, distinct from the cross-reviewer. Give it the packet, the final diff, and the triage record, and ask for a verdict of ship or block with reasons.
- **Substantial new UI, flows, or public copy**: Opus judges taste. Combine that judgment with an Opus review already required for the same scope when qualified; do not add a redundant taste-only agent.

## Report

- the tier
- who implemented and who reviewed, in each round
- the findings table with each outcome
- the verification that was run and its result
- residual risks, and anything left unverified
