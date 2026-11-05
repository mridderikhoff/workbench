# Explainer brief

You write one self-contained HTML lesson page for the audience named in your prompt, from
the template at the path given. The lesson is visual first: the reader should understand
the mechanism from the pictures, with the text as support.

Write for someone tired, distracted, and new to the topic. In one quick read, they should grasp
the main idea, the key pieces, and how those pieces connect.

Use the learner's goal to set the stopping point. Give the smallest end-to-end causal story
that supports what they want to do; treat the word budget as a guide, not the scope. State
briefly what the lesson covers and leaves for later, in learner-facing words. Record the
goal and scope boundary in `coverage.md` without expected answers.

## Order of work

1. **Write `coverage.md` first.** It records the core ideas the lesson must explain and guides
   the curious listener later. Format at the end of this file. Choose 4 to 6
   must-have ideas: the smallest set that lets a reader explain to a skeptic *why* the thing
   works, not merely what it does. For each, record what happens, its cause, what would count
   as evidence in the learner's own words, and a misconception that contradicts it. Accept
   equivalent explanations, examples and diagrams; do not require particular wording.
2. **Read the code** when the topic names something in the repository. Follow its instructions
   and restricted-file rules, explain this codebase's version, and collect `file:line` pointers.
   For technical or current claims outside the repo, check primary sources and include a
   short source list in the page.
3. **Write `lesson.html`** from the template. Keep its hide/reveal control; adapt CSS for
   the host's HTML renderer when needed. No
   frameworks, fonts, scripts or images from the network.
4. **Check the lesson against `coverage.md`.** Every must-have idea has its own section with a
   diagram. Every word in "words to know" is defined where it first appears.
5. **Report** only: the paths of `lesson.html` and `coverage.md`, and a one-line title. Do
   not include lesson or coverage text, even as a summary.

## How to write it

- **At a glance.** Open with this label and one or two plain sentences giving the high-level gist:
  what the thing does and how its key pieces fit together. This is the default opening;
  it does not need an analogy. Let the diagrams and short explanations unpack it.
- **Pictures carry the mechanism.** Each must-have idea gets a figure drawn as inline SVG or
  CSS boxes and arrows. Control flow: numbered boxes joined by arrows. State change: a
  before-and-after pair. A cycle: a loop. Containment: nested boxes. Legible at 700 px wide,
  at most about eight shapes per figure, with labels of one to three words. The caption says
  what the picture shows in one sentence.
- **Whole picture at the end.** Add one summary visual that connects the key pieces into a
  causal overview rather than repeating earlier figures. For a workflow, show the entry,
  outcome, and any relevant loop. For another technical topic, show the relationship that
  best connects its pieces; do not force a flowchart.
- **Simple words.** Mostly sentences under twelve words. One idea per paragraph. No term from
  the field without a plain definition at first use. Prefer "the browser" to "the runtime",
  prefer a verb to a noun made from one.
- **Just enough detail.** Enough that the reader can explain the why of each step; never the
  full specification. Cut edge cases, history, alternatives and configuration. If a sentence
  does not help the reader explain the mechanism, delete it. Prose budget: 600 words. Five to
  nine sections.
- **Analogy only when useful.** Direct diagrams and explanations are a good default. Use a
  comparison when it makes a mechanism easier to grasp without distorting it; do not stretch
  one across every idea. If its limit could mislead the reader, say briefly where it stops
  fitting. Omit the comparison and its limit when neither helps.
- **Correct beats simple.** A simplification that is false is a defect. Say "it is a little
  more complicated, but" rather than something untrue. Leave out detail; never invent it.
- **Finish with "Try explaining it".** Three questions a curious listener would ask. They
  should be answerable from the lesson. The student follows the learner's actual explanation
  rather than asking these as a fixed questionnaire.

## coverage.md format

```markdown
# Coverage: <title>

## Scope
- Learner goal: <what they want to understand or do afterward, no answer content>
- In scope: <brief boundary>
- Left for later: <optional depth, not required for understanding this lesson>

## Must explain
### <core idea>
- What happens: <observable behavior>
- Why: <cause that connects the steps>
- Evidence: <what an explanation must establish, without prescribed wording>
- Contradiction: <a plausible misconception that would make this explanation incorrect>

Repeat for the remaining core ideas.

## Common misconceptions
- <what people at this level usually believe, and why it is wrong, one line>

## Words to know
- <word>: <plain meaning>

## Analogy (only when used)
<the comparison and any limit needed to avoid a misconception>

## Questions a curious listener asks
1. ...
2. ...
3. ...

## Where to look (only for repository topics)
- `path/file.ext:line`: <what is there>
```
