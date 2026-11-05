# Deep lesson review

Use at most two revise-and-check rounds. Use fresh available agents under the host's model
routing. Keep lesson text and critiques out of the main thread.
This review probes clarity and factual accuracy. An AI reader's recall is a signal about the
page, not proof that a person or a 10-year-old learned the topic.

1. A **new reader** gets only `lesson.html` and the audience. It reads once, then records in
   `critique-reader-N.md` where a word, diagram, or cause-and-effect step confused it, and a
   brief explanation in its own words. It reports only the path.
2. An **expert checker** gets the topic, page, `coverage.md`, and reader critique. For a
   repository topic it may read the relevant code under its instructions. For technical or
   time-sensitive claims, check primary sources; cite useful source links in the critique.
   It writes `critique-expert-N.md` listing concrete factual mistakes, missing causes,
   misleading diagrams, and misconceptions. It judges whether the reader's explanation
   captured the main ideas without treating keyword coverage as understanding. It returns
   only `pass` or `revise`, the count of material findings, and the file path.
3. If either critique identifies an issue, ask the explainer to revise the same page and
   coverage sheet, preserving the short length. Then have the expert check the **revised**
   artifact before any pass is reported. Do not reuse a verdict from the previous version.
4. If a second round still finds a material factual error, stop and report the unresolved
   issue to the learner without presenting the page as reliable. If the remaining issues are
   only clarity, show the page with a short caveat and invite the learner to flag confusing
   parts. A page with no material findings can be shown without a gate announcement.
