---
name: grill-me
description: Interview the user until a request's scope is exhausted: every ambiguity, hidden requirement, edge case, and boundary is surfaced and settled before any work starts. Use when the user says "grill me", asks to nail down or exhaust the scope of a request, or hands over a vague or large ask that would be risky to build on guesses. Complements challenge-me, which tests whether the approach is right; this one pins down what is being asked.
---
Treat the request as unfinished. Your job is to end with a scope so complete that someone
who never saw this conversation could build it without asking a single question. Do not
plan, design, or implement until that bar is met.

## Look before you ask

Anything the code, docs, tickets, or existing behavior can answer, answer yourself first.
Read the relevant files, then ask only what remains. Never spend my attention on a
question you could have looked up. When you do ask, cite what you found ("the table
already does X in `file:line`; should the new one match?").

## Sweep every dimension

Work through these until none has an open question. Skip a dimension only after confirming
it does not apply, and say so in one line.

- **Outcome:** what is different for the user when this is done? How will we know it worked?
- **Who and where:** which users, roles, screens, apps, or entry points are affected?
- **Boundaries:** what is explicitly out of scope? What looks related but should not change?
- **Inputs and states:** empty, loading, error, partial, very large, very small, disabled,
  read-only, first-time, repeat.
- **Behavior:** the normal path, then each exception. What happens on cancel, retry,
  concurrent edits, or interruption?
- **Compatibility:** existing consumers, public API, saved data, translations, themes,
  accessibility, keyboard and screen-reader behavior.
- **Constraints:** performance, bundle size, deadlines, dependencies, things we must reuse.
- **Quality bar:** tests expected, docs to update, visual review, who signs off.
- **Delivery:** one change or several, branch and ticket, rollout, what can be deferred.
- **Assumptions:** list what you are quietly assuming and ask which are wrong.

## How to ask

- One focused round at a time, at most four questions, ordered by how much the answer
  changes the work. Earlier answers reshape later questions, so do not front-load everything.
- Every question carries your recommended answer and the reason, so I can reply "yes" to
  agree. Offer concrete options rather than open-ended prompts.
- Do not accept a vague answer. "Probably", "whatever is simplest", or "like the other
  one" gets a follow-up that makes it specific, or an explicit decision to defer it.
- Keep a running ledger of decisions. If a new answer contradicts an earlier one, point it
  out and make me choose.
- If an answer exposes a larger gap, follow it down before moving on.

## When to stop

Stop when a full sweep turns up no new question and every open item is either decided,
deferred on purpose, or out of scope. Then write the result and ask me to confirm it:

1. **Scope:** a short paragraph of what will be built.
2. **Decisions:** each choice with its one-line reason.
3. **Out of scope:** what was ruled out or deferred.
4. **Acceptance:** concrete checks that show it is done.
5. **Risks and unknowns:** anything still unresolved, with an owner.

Do not start the work until I confirm. If I say "enough", stop grilling, list what is
still open, and proceed on your stated recommendations for those items.

Keep the pressure in the thoroughness, not the tone: exacting and relentless about gaps,
plain and polite in wording, without combat framings.
