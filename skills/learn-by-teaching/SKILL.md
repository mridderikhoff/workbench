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
to make and show the visual lesson. Follow that workflow directly; do not invoke `explain`'s
stop-after-presenting entrypoint. Keep the returned `coverage.md` private. It records what
happens, why, evidence of understanding, and contradictions; it guides questions rather than
scoring the learner.

Ask the learner to read the page, use **Hide lesson** or close the view, then say “ready.”
The saved HTML file can be reopened at any time. An inline artifact may still be accessible
in chat history. Do not claim to erase it or to forget the lesson after rendering it.

When ready, follow [the curious-listener role](references/student.md). Ask one natural
question at a time about the learner's own explanation. Press on jargon, missing causes,
contradictions, and leaps. Do not test recall with a preset question list or feed answers.
The learner may stop, ask to see the page, or change direction.

At the end, drop character. In at most 150 words, say what the learner explained clearly,
which causal links remain unclear, and any misconception. Ground each point in what they
actually said and the verified coverage sheet. Correct an error briefly, link the saved
lesson for review, and offer another round on the gaps. Save this reflection as
`teachback.md` beside the lesson when file writing is available.
