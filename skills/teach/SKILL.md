---
name: teach
disable-model-invocation: true
description: >
  Teach a topic with a short visual HTML lesson, then let the learner explain it back
  to a curious student who probes gaps without quizzing. Invoke as /teach in Claude
  Code or $teach in Codex. Optional --deep critiques the lesson; --doc makes only the lesson.
metadata:
  argument-hint: "topic [--deep] [--doc] [--level audience]"
---

# Teach

Make a self-contained visual lesson, then invite the learner to explain the mechanism in their
own words. During the explanation, be a curious listener: ask why and press on missing links.
Do not turn the exchange into a test. The learner can stop or ask for the lesson at any time.

`--doc` ends after the lesson. `--deep` adds the bounded review in
[references/critics.md](references/critics.md) before either mode shows the lesson.
`--level` sets the audience; default to a curious 10-year-old. For a topic in the current
repository, explain that repository's implementation and include useful `file:line` pointers.
Follow repository instructions and source-reading restrictions when investigating it.

## Make the lesson

Create a unique temporary directory with `lesson.html` and `coverage.md`. Assign the lesson
and coverage sheet to a fresh available subagent. Use the host's model routing and the user's
choice; do not require a named provider. Give it the topic, audience, output paths,
[references/explainer.md](references/explainer.md), and
[templates/lesson.html](templates/lesson.html). Ask it to return only the paths, the coverage
sheet, and a title. Keep lesson text out of the main thread so the later student has not read
it. The coverage sheet gives observable checkpoints, including causes and contradictions.
Use it to track evidence and choose questions, without showing a score or requiring keywords.

If subagents are unavailable, write the lesson yourself and say plainly that you have read
it; continue the student role without pretending to have forgotten it. If `--deep` is
requested and independent reviewers are unavailable, explain that the deep review could not
run; do the normal lesson instead. Never claim the deep gate passed without a review.

For `--deep`, follow [references/critics.md](references/critics.md). Resolve material factual
errors before presenting the page. A failed clarity review after two rounds may be shown with
a brief plain-language caveat; a known factual error may not.

## Show and hide

Show the page inline when the host supports an HTML artifact. In T3, have the explainer call
`html_preview` then `html_render` with the file's HTML, adapting the template to the tools'
theme and layout rules. Have it return only paths and coverage, keeping the lesson out of
the main agent's context. If child renders are not visible in the parent thread, the main
agent may render it and disclose that it has now read the lesson. Never claim otherwise.

Also give the learner a clickable link to `lesson.html` and, in WSL, the output of
`wslpath -w` in a code span. If inline display is unavailable, use that file in a browser.
The page has a **Hide lesson** control. Ask the learner to read, hide or close it, and say
“ready.” Hiding removes it from the current view; it does not erase browser history or
earlier chat content. Do not quote lesson prose into chat. The saved page remains available
for review. In `--doc`, the main agent may read and render it directly, then stop here.

## Listen

When the learner is ready, follow [references/student.md](references/student.md). Ask one
question at a time until the explanation would satisfy a curious skeptic, the learner asks
to stop, or the learner wants to see the lesson again. Never supply answers mid-round.

At the end, drop character. In at most 150 words, reflect what was explained well, what
remains unclear, and any misconception, using the coverage sheet and verified sources.
Correct an error briefly, point to the saved page for review, and offer another round on the
gaps. Save that reflection as `teachback.md` beside the lesson when file writing is available.
