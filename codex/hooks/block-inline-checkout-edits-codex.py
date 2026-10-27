#!/usr/bin/env python3
"""Codex-side adapter for the shared main-working-tree write block.

The decision logic lives once, in
~/.claude/hooks/block-inline-checkout-edits.py, which expects a Claude Code
PreToolUse payload: one tool call, one `file_path`. Codex agrees on the
surrounding contract — same `tool_name` / `tool_input` / `cwd` field names, same
"exit 2 plus a reason on stderr blocks the call" convention — but writes files
through a single `apply_patch` tool whose input carries a patch body that can
touch several paths at once.

So this wrapper does only the shape adaptation: pull every path the tool call
would write, then run the canonical script once per path and block on the first
refusal. Nothing about which paths are allowed is decided here.

Registered without a matcher in ~/.codex/hooks.json, so it sees every
PreToolUse and filters by tool name itself. A matcher naming `apply_patch`
would silently stop firing if Codex renamed the tool — the same
unregistered-hook failure this is meant to prevent.

Malformed or unrecognised input is a no-op, never a failure: a hook that
hard-fails breaks every write in the session. Like the script it delegates to,
this is not a security boundary — a patch applied through the shell bypasses it.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

CANONICAL = os.path.expanduser("~/.claude/hooks/block-inline-checkout-edits.py")

# Codex writes through apply_patch; the Claude-side names are accepted too so a
# single registration keeps working if Codex grows per-file edit tools.
WRITE_TOOLS = {"apply_patch", "Edit", "Write", "MultiEdit", "NotebookEdit"}

DIRECT_PATH_KEYS = ("file_path", "notebook_path", "path", "filename", "file")

# Fields that may carry a raw patch body, depending on apply_patch tool type
# (freeform hands over the patch as text; the function form wraps it).
PATCH_TEXT_KEYS = ("input", "patch", "content", "text", "arguments", "diff")

PATCH_HEADER = re.compile(
    r"^\*\*\* (?:Add|Update|Delete) File: (.+?)\s*$|^\*\*\* Move to: (.+?)\s*$",
    re.MULTILINE,
)


def candidate_paths(tool_input: object) -> list[str]:
    """Every path the tool call would write, in first-seen order."""
    found: list[str] = []

    def remember(value: object) -> None:
        if isinstance(value, str) and value.strip() and value not in found:
            found.append(value.strip())

    def scan_patch_text(text: str) -> None:
        for add_update_delete, move_to in PATCH_HEADER.findall(text):
            remember(add_update_delete or move_to)

    if isinstance(tool_input, str):
        scan_patch_text(tool_input)
        return found

    if not isinstance(tool_input, dict):
        return found

    for key in DIRECT_PATH_KEYS:
        remember(tool_input.get(key))

    # Some shapes key the edit map by path: {"changes": {"a.py": {...}}}
    for key in ("changes", "files", "edits"):
        value = tool_input.get(key)
        if isinstance(value, dict):
            for path in value:
                remember(path)
        elif isinstance(value, list):
            for entry in value:
                if isinstance(entry, str):
                    remember(entry)
                elif isinstance(entry, dict):
                    for inner in DIRECT_PATH_KEYS:
                        remember(entry.get(inner))

    for key in PATCH_TEXT_KEYS:
        value = tool_input.get(key)
        if isinstance(value, str):
            scan_patch_text(value)

    return found


def blocked(path: str, cwd: str) -> str | None:
    """The canonical script's refusal reason for `path`, or None if allowed."""
    payload = json.dumps(
        {
            "hook_event_name": "PreToolUse",
            "tool_name": "Write",
            "tool_input": {"file_path": path},
            "cwd": cwd,
        }
    )
    try:
        result = subprocess.run(
            [sys.executable, CANONICAL],
            input=payload,
            capture_output=True,
            text=True,
            timeout=15,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stderr.strip() if result.returncode == 2 else None


def main() -> int:
    if not os.path.exists(CANONICAL):
        return 0

    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0
    if not isinstance(payload, dict):
        return 0

    if payload.get("tool_name") not in WRITE_TOOLS:
        return 0

    cwd = payload.get("cwd") or os.environ.get("CODEX_PROJECT_DIR") or os.getcwd()

    for path in candidate_paths(payload.get("tool_input")):
        reason = blocked(path, cwd)
        if reason:
            print(reason, file=sys.stderr)
            return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
