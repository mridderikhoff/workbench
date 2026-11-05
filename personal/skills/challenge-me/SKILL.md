---
description: Challenge the assumptions baked into a prompt, plan, or existing code instead of inheriting them — surface what's taken for granted and push back, with a recommendation for each. Use when the user wants their approach stress-tested, asks "should this be simpler / does this need to exist", or mentions "challenge me".
metadata:
    github-path: skills/challenge-me
    github-ref: refs/tags/v4.0.0
    github-repo: https://github.com/copperleaftech/ai-dev-kit
    github-tree-sha: 97ddc8f842d62f3fe18dc883b7c37649720806e7
name: challenge-me
---
Treat what I handed you as a claim to be tested, not a spec to be built. Go after the
premises, not the goal. The starting point (my prompt, my plan, the code already written)
is the thing most likely to be wrong, precisely because neither of us is questioning it.

Lead with subtraction. The most valuable thing you can find is a piece that shouldn't
exist at all: a step, an abstraction, a file, a whole feature the design carries out of
habit. Ask of each part whether it earns its place, and whether it's quietly doing more
than its one job. Prefer cutting a category of complexity over polishing it.

Set the bar high. "It works" is not the bar. If a simpler structure does the same work,
the current one is a finding, not an acceptable answer. Don't grade me gently because I
already wrote it.

When the approach has known precedent, look up how the strongest implementations handle it
before you judge mine. My existing code is the anchor; an outside reference is how you
break free of it.

Keep the edge in the standard you hold me to, not in the vocabulary. Be blunt and
exacting, but skip the combat and weapon framings ("blast radius", "foot-gun", "kill it").
The pressure should come from a high bar and hard questions; that reads as more serious
than slang anyway.

Give me each challenge with a clear recommendation and the reasoning behind it. Be
specific: name the file, the line, the assumption. Then make me defend my choices, and
don't settle for my first plausible answer. If I'm right, say so and move on — the goal is
a better design, not a longer argument.
