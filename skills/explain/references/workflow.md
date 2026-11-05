# Shared lesson workflow

This is the single lesson-generation procedure for `explain` and `learn-by-teaching`. Resolve
paths from this file's parent skill directory (`skills/explain`), not from the current working
directory. The caller owns what happens after the page is ready. Do not treat `explain`'s
stop-after-presenting rule as a stop for `learn-by-teaching`.

Infer the topic, audience, desired depth, and whether independent review is worthwhile from
the person's words. Default to a curious 10-year-old, simple words, a few diagrams, and the
smallest causal story that explains the mechanism. A request to share or rely on the lesson,
or a complex or consequential topic, warrants the review in [critics.md](critics.md). Ask one
brief plain-language question only when consequential uncertainty cannot be resolved from
context; otherwise make a reasonable choice and continue.

Create a unique temporary folder holding `lesson.html` and `coverage.md`. Give the topic,
audience, folder, [explainer.md](explainer.md), and
[the HTML template](../templates/lesson.html) to a fresh available subagent. Use the host's
model routing and the person's model choice. Ask it to return the page path, private coverage
sheet, and title without lesson prose. For repository topics, it follows local instructions
and restricted-file rules. If no subagent is available, the main agent writes the lesson and
is honest later that it has read it.

Run [critics.md](critics.md) when independent review is warranted. Correct known factual
errors before showing the page. Reviewers and the explainer should keep the page concise
while fixing gaps. Do not claim an AI reader's recall proves a human will understand.
If independent reviewers are unavailable, disclose that limitation and check the sources
yourself; do not claim the review ran.

Present the page as a visual artifact. In T3, pass the HTML to `html_preview`, then
`html_render`; adapt the rendered copy to those tools' layout rules if needed, while keeping
the saved standalone `lesson.html` usable in a browser with no server. Do not dump its prose
into chat. Also give a clickable link to `lesson.html`; on WSL append its actual `wslpath -w`
path in a code span. If the host cannot render HTML inline, use the saved file as the visual
artifact. Inline rendering may put the HTML in the main agent's context; it does not put the
lesson prose in chat. The Hide lesson control hides the current view, not chat history or
the agent's context. The saved file remains available for rereading.

Return the page path and private coverage to the `learn-by-teaching` caller so it can listen
and probe; return only the page artifact/link to the `explain` learner.
