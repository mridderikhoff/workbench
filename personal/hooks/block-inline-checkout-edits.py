#!/usr/bin/env python3
"""PreToolUse hook: block file edits that land in a repository's main working tree.

The worktree-only rule is a working agreement, and an instruction can be
reasoned around — a session prompt that suppresses sub-agents reads, wrongly,
as suppressing the worktree requirement with it. This hook removes the
judgement call: a write to the main checkout fails mechanically, for the main
session and every sub-agent alike, whatever the prompt says.

Also blocked: any write inside the QA runtime tree (a linked worktree carrying
a .wt-qa-runtime marker at its toplevel) — that tree only ever runs the app,
and fixes belong in the feature branch's worktree.

Allowed through:
  * paths in a linked worktree (git-dir differs from git-common-dir),
    unless it is the QA runtime tree
  * paths outside any git repository (scratchpad, ~/.claude, /tmp)
  * git-ignored paths — they cannot dirty the tree
  * main-checkout paths while <toplevel>/.claude/allow-inline-edits exists;
    the marker never bypasses the QA-runtime block

Not a security boundary: shell writes (heredocs, sed) bypass it entirely.
It catches the reasoning slip, not a determined caller.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

WRITE_TOOLS = {"Edit", "Write", "MultiEdit", "NotebookEdit"}
BYPASS_MARKER = os.path.join(".claude", "allow-inline-edits")
QA_RUNTIME_MARKER = ".wt-qa-runtime"


def git(args: list[str], cwd: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", "-C", cwd, *args],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def nearest_existing_directory(path: str) -> str:
    directory = os.path.dirname(path)
    while directory and not os.path.isdir(directory):
        parent = os.path.dirname(directory)
        if parent == directory:
            break
        directory = parent
    return directory or os.getcwd()


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    if payload.get("tool_name") not in WRITE_TOOLS:
        return 0

    tool_input = payload.get("tool_input") or {}
    target = tool_input.get("file_path") or tool_input.get("notebook_path")
    if not target:
        return 0

    base = payload.get("cwd") or os.getcwd()
    target = os.path.realpath(os.path.join(base, target))
    probe = nearest_existing_directory(target)

    layout = git(
        ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir"],
        probe,
    )
    if not layout:
        return 0

    toplevel = git(["rev-parse", "--show-toplevel"], probe)
    if not toplevel:
        return 0

    if os.path.exists(os.path.join(toplevel, QA_RUNTIME_MARKER)):
        relative = os.path.relpath(target, toplevel)
        print(
            f"Blocked: {relative} is in the QA runtime tree ({toplevel}), which only "
            "runs the app and is never edited — not by the main session and not by "
            "sub-agents. Fixes belong in the feature branch's own worktree. Commit "
            "there and report `~/.claude/bin/wt qa <branch>` for the human; only "
            "attach when their current request explicitly asks you to.",
            file=sys.stderr,
        )
        return 2

    if os.path.exists(os.path.join(toplevel, BYPASS_MARKER)):
        return 0

    lines = layout.splitlines()
    if len(lines) != 2 or os.path.realpath(lines[0]) != os.path.realpath(lines[1]):
        return 0

    if git(["check-ignore", "-q", target], probe) is not None:
        return 0

    relative = os.path.relpath(target, toplevel)
    print(
        f"Blocked: {relative} is in the main working tree of {toplevel}, which is "
        "shared with other concurrent sessions. Every edit goes through a worktree "
        "and lands as a commit — this holds for you directly, not only for "
        "sub-agents, and however small the edit is.\n\n"
        "Provision one at the current tip and edit at the path it prints:\n"
        "  ~/.claude/bin/wt new <branch> [base]\n\n"
        "Use that command, not `git worktree add` — it pins the base to a tip SHA, "
        "refuses while the checkout is dirty, and sets up the gate environment. A "
        "refusal is information about the tree, never something to route around.\n\n"
        "Commit there, then publish the feature branch with `~/.claude/bin/wt ship "
        "<branch>`; integration into the parked base branch happens through its PR. "
        "If this particular edit is meant to happen "
        f"inline, ask the user to run: touch {toplevel}/{BYPASS_MARKER}",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
