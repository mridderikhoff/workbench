---
name: pr-backend-review-artifact
disable-model-invocation: true
description: >
  Build a one-screen review guide that asks backend reviewers for an opinion on a PR's
  server-side approach, publish it on Copperleaf Pages, and link it at the top of the PR
  description. Invoke-only: run it when the user types /pr-backend-review-artifact <PR>.
---

# PR backend review artifact

The author is not a backend expert. Agents already catch line-level bugs, so the guide asks
humans only for what agents can't judge: **approach, placement, cost and contracts**.
`example.html` beside this file is the approved result. Match its structure, length and styling.

## Rules for the content

- **One screen.** No walls of text. Every item is one or two lines.
- **Only what this PR changes.** Never re-explain how the system works today, never give
  background, never describe fallbacks for old data, and never recap agent reviews.
- **Plain English.** Name the code (file, field, flag) in `code` and skip the mechanics.

## Structure

1. **Top box: two sentences.**
   - **What:** the user-visible change, plus the one reason it needs server changes.
   - **What I'd like from you:** an opinion on the approach, since agents have reviewed for bugs.
2. **What changed on the server:** a table of `Where | Change`, with one row per app or service
   and only the new behaviour: new fields, limits, where they're built and stored.
3. **Where a human opinion helps:** 4–6 numbered items, each one a choice the PR made.
   - Give each item a bold title naming the decision, one line on what the PR does, and a muted
     **Alternative:** line saying what the other option would cost (re-ingest, extra request,
     storage, more logic).
   - Good topics: whether this is the right layer or app for the logic, duplicated knowledge
     across apps, storage or payload growth, a security contract the PR narrows (cite the
     threat-model ID), feature-flag gating, and backfill or migration choices.

## Procedure

1. Read the PR's server-side diff (`git diff origin/<base>...HEAD -- <backend paths>`) and its
   spec or ticket, if any, to find the decisions. Ask the user only if the PR's motivation
   isn't recoverable from them.
2. Write `index.html` into the repository's gitignored scratch folder, following
   `example.html`. In cl-strategy that's `_private/specs-scratch/<spec-folder>/backend-review/`
   under the main clone; anywhere else, use a temporary folder outside the checkout.
3. Show the user the top box and the question titles. Publish only once they confirm.
4. Publish with the `publish-artifact` skill using `--slug <ticket>-backend-review --with-tag pr`
   (the user's saved lifetime and visibility defaults apply). Republish to the same slug when
   revising.
5. Prepend this line to the PR description, keeping the rest of it, by updating the PR through
   `gh api -X PATCH repos/<owner>/<repo>/pulls/<n> -F body=@<file>` (`gh pr edit` can fail on
   classic Projects):
   `**Backend reviewers:** start with the [review guide](<url>). It lists what changed on the server and the approach questions that need a human opinion.`
6. Report the artifact URL and confirm that the PR description now links to it.
