---
name: learn-by-teaching
disable-model-invocation: true
description: >
  Learn a coding or technology topic from a visual HTML lesson, then explain it back
  to a curious listener who probes gaps without a quiz. Use for software or technical
  teach-back requests.
metadata:
  argument-hint: "coding or technology topic"
---

# Learn by teaching

Use the sibling `explain` skill's [shared lesson workflow](../explain/references/workflow.md)
to make and show the lesson. Follow that workflow directly; `explain`'s stop-after-presenting
rule does not apply here. Keep the returned coverage **path** private.

The main agent coordinates; it must never play the listener. An evaluator sees the private
coverage and transcript. A fresh isolated listener sees only the learner's words, previous
listener turns, and a carefully limited gap report. This is separation of prompts and
context, not a filesystem sandbox or a claim that a model lacks its own knowledge.

## Teach-back turns

Ask the learner to read the page, use **Hide lesson** or close it, and say “ready.” The saved
file can be reopened. An inline artifact may remain in chat history. On “ready,” say only
“Okay, teach me [topic]. Start wherever you like.” Wait for the learner's explanation;
there is no evaluation before it.

At readiness, read the private coverage and the evaluator/listener role texts **once** into
the coordinator's context. For each live turn, embed only the role and inputs named below;
neither child uses tools or rereads files. Request **low reasoning effort explicitly in the
host call settings** for both fresh evaluator and listener, using an available capable model.
In T3, discover settings once per session with `orchestrator_capabilities` and pass its supported low-effort setting in
`delegate_task.target.options`; use the host's equivalent when available. Do not switch to
premium fast/priority service or change global settings. If per-call low effort is unavailable,
say so rather than claiming it was set. Keep uncertain evidence `unclear`; speed does not
relax completion checks.

Keep a transcript of **speaker-attributed, numbered turns** (`L1`, `S1`, `L2`, …). After each
substantive learner turn:

1. Give a **fresh isolated evaluator**, with no forked conversation or tools, only the
   embedded [evaluator role](references/evaluator.md), private coverage **text**, topic, and
   full raw transcript. Keep its compact audit private; save it beside the lesson if useful.
2. Parse the evaluator's JSON response with separate `private_audit` and `listener_report`
   fields; reject malformed output. Check every evidence quote in the private audit against its cited learner turn, including
   the learner-stated causal link for each item marked explained. Reject fabricated quotes,
   agent-attributed evidence, and a complete verdict with missing or contradicted items.
   Item statuses must be exactly explained, unclear, or missing; keep contradictions in a
   separate field. Reject any other status. Then check the limited listener report. Its
   learner quote must occur verbatim in the
   cited learner turn. The gap must be a declarative description, not a question, and grounded in
   that turn, without a new answer term, expected mechanism, correction, suggested question,
   rubric label, or expert reasoning. For an entirely unmentioned idea, pass only `continue`
   and a neutral invitation anchored in the topic or learner's own words. If the report leaks
   an answer, reject it and request a safer report from the evaluator. Never forward the
   full audit, coverage text/path, lesson, or main-thread context. Allow one retry for an
   invalid audit or leaking report; if it still fails, pause without declaring completion.
3. If the safe report says `complete`, end the round. Otherwise start a **new isolated
   listener call with no fork**. Embed the text of
   [the listener role](references/student.md) in its prompt; give it only that role, the topic
   and audience, the speaker-attributed learner/listener transcript, and the sanitized
   report. Give it no role-file path or tool use; it must not read workspace files or seek
   more context. Never reuse the explainer, evaluator, or a prior listener. Relay its single
   plain-text question verbatim after checking that it contains no answer,
   correction, or unintroduced concept. If it leaks, request a safe question from a new
   listener call with the same limited input. Allow one retry, then pause the round if it
   still leaks. Do not expand the question yourself.

If the learner says stop, done, or give up, skip the listener and go to the mirror; an
unfinished explanation is not declared complete. If they ask to reread, return the saved
lesson link and pause. For “how am I doing?”, report progress without answers or a false
pass, then resume when they explain more. If isolated agents are unavailable, offer the
lesson alone or wait for them; do not quietly combine evaluator and listener roles.

## Mirror

After completion or a requested stop, a separate mirror role may read the coverage,
evaluator audit, and transcript. In at most 150 words, say what the learner explained
clearly, which causal links remain unclear, and any misconception. Ground each point in
their actual words. Brief correction is allowed **only now**. Link the saved lesson and
offer another round on the gaps. Save the reflection as `teachback.md` when possible.
