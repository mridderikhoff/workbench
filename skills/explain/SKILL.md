---
name: explain
disable-model-invocation: true
description: >
  Explain a topic in a concise, visual, self-contained HTML lesson. Use when the person
  wants an explanation or teaching document to read or share. This skill stops after
  presenting the lesson; interactive teach-back uses learn-by-teaching.
metadata:
  argument-hint: "topic or natural-language learning request"
---

# Explain

Follow [the shared lesson workflow](references/workflow.md) with the person's topic and
intended audience. Return the finished visual page as an HTML artifact and a clickable file
link. The private `coverage.md` is for making and reviewing the page; do not show it.

Stop after presenting the lesson. If the person wants to explain it back to a curious
listener, use the sibling `learn-by-teaching` skill on that request.
