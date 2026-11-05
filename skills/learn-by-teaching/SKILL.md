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
to make and show the lesson. Keep the returned coverage path private. The main agent
coordinates and relays; it never plays the listener. A persistent isolated listener holds
only the learner/listener conversation. A separate evaluator sees the private coverage only
at natural checkpoints. These are context boundaries, not a filesystem sandbox.

## Start the conversation

Ask the learner to read the page, use **Hide lesson** or close it, and say “ready.” The saved
file can be reopened; an inline artifact may remain in chat history. At readiness, cache
the coverage and both role texts once in the coordinator. Start **one isolated listener
session with no fork or tools**. Embed [the listener role](references/student.md) in its
initial prompt, plus only the topic, audience, learner goal, and answer-free scope boundary.
Send no lesson, coverage, audit, parent
history, file path, or role-file path. Never use the explainer or evaluator as listener.
Relay its opening verbatim and wait for the learner. Do not run an evaluator yet.

Request low reasoning effort **in the host call settings** for the listener and each fresh
evaluator, using an available capable model. In T3, discover the supported option once with
`orchestrator_capabilities` and pass it in `delegate_task.target.options` when starting each
agent. Resume the existing listener session for later turns (`t3_thread_send` in T3 or
`followup_task` for a native agent); do not start a new listener for ordinary replies.
If the host cannot resume it or set low effort, say so and offer to pause or continue with
the available mode. Do not claim persistence or low effort when unavailable. Do not switch
to premium fast/priority service or change global settings.

## Listen and check

Maintain a raw speaker-attributed transcript with numbered learner and listener turns
(`L1`, `S1`, `L2`, …). For each ordinary learner explanation, send **only that message** to
the same listener session. Its own context retains the preceding conversation and any
validated neutral gap. Relay its one question verbatim after checking that it contains no
answer, correction, or unintroduced concept. Do not expand it. If a prompt or response
contaminates the listener with a hidden answer, replace it with a clean isolated listener
using only the allowed transcript and safe gaps; never fork the contaminated session.

Run a **fresh isolated evaluator**, with no fork or tools, only when the learner asks for
progress, the end of a substantial explanation or repeated questioning suggests a useful
pause, or
the listener returns the reserved `CHECKPOINT` token because it cannot find another useful
question or thinks the explanation may be complete. There is no every-turn or fixed-turn
evaluation; an ordinary message boundary is not a checkpoint. Give it the cached
[evaluator role](references/evaluator.md), coverage **text**,
topic, and full numbered raw transcript. Keep its compact audit private. For an explicit
“done,” stop, or give up, skip further listener questions, run a final audit, then mirror;
incomplete evidence never becomes a pass.

At a checkpoint, parse `private_audit` and `listener_report` as JSON. Check each evidence
quote against its cited learner turn and the learner-stated causal link for every explained
item. Reject fabricated or agent-attributed evidence, invalid statuses, and a complete
verdict with missing items or unresolved contradictions. Check the listener report's
quote against the cited turn and its gap for answer terms, expected mechanisms, corrections,
suggested questions, labels, and private reasoning. An unmentioned idea gets only a neutral
invitation anchored in the topic or learner's words. Retry an invalid audit or leaking
report once, then pause without declaring completion.

If the evaluator flags a checkpoint outside the declared scope, repair that private
checkpoint against the lesson before reevaluating. Do not send it to the listener or count
the mismatch as a gap in the learner's understanding.

If the verified report says `complete`, end the round. Otherwise send **only its sanitized
neutral gap** to the same listener. Never forward the audit, coverage, or lesson. If the
learner asked for progress, first give a short progress note without answers or a false
pass, then resume the listener when they are ready. If the
listener returns `CHECKPOINT` again without meaningful new learner evidence, retry once
with the safe gap, then pause honestly rather than cycling or passing it. For a listener
question that leaks an answer, replace the contaminated listener with a clean one and retry
once; pause if the replacement also leaks. The learner may reread at any time: link the
saved page and pause without evaluating or claiming completion.

## Mirror

After a verified completion or explicit stop, a separate mirror role may read the coverage,
audit, and transcript. In at most 150 words, say what the learner explained clearly, which
causal links remain unclear, and any misconception, grounded in their words. Correction is
allowed **only now**. Link the saved lesson and offer another round on the gaps. Save the
reflection as `teachback.md` when possible.
