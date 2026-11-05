#!/usr/bin/env python3
"""Keep Codex subagents on the efficient model with isolated context."""

from __future__ import annotations

import json
import os
import sys
import tomllib
from pathlib import Path


SUBAGENT_MODEL = "gpt-5.6-terra"
SUBAGENT_REASONING_EFFORT = "medium"


def conflicting_custom_agent(agent_type: object, cwd: object) -> str | None:
    if not isinstance(agent_type, str) or not agent_type:
        return None

    directories = [Path.home() / ".codex" / "agents"]
    if isinstance(cwd, str) and cwd:
        current = Path(cwd).resolve()
        directories.extend(parent / ".codex" / "agents" for parent in (current, *current.parents))

    seen: set[Path] = set()
    for directory in directories:
        if directory in seen or not directory.is_dir():
            continue
        seen.add(directory)
        for path in directory.glob("*.toml"):
            try:
                config = tomllib.loads(path.read_text())
            except (OSError, tomllib.TOMLDecodeError):
                continue
            if config.get("name") != agent_type:
                continue
            model = config.get("model")
            effort = config.get("model_reasoning_effort")
            if model not in (None, SUBAGENT_MODEL) or effort not in (
                None,
                SUBAGENT_REASONING_EFFORT,
            ):
                return str(path)
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    if not isinstance(payload, dict) or payload.get("tool_name") != "Agent":
        return 0

    tool_input = payload.get("tool_input")
    if not isinstance(tool_input, dict):
        return 0

    conflict = conflicting_custom_agent(
        tool_input.get("agent_type"), payload.get("cwd") or os.getcwd()
    )
    if conflict:
        print(
            json.dumps(
                {
                    "hookSpecificOutput": {
                        "hookEventName": "PreToolUse",
                        "permissionDecision": "deny",
                        "permissionDecisionReason": (
                            "Subagent policy blocked a custom model override in " + conflict
                        ),
                    }
                }
            )
        )
        return 0

    updated_input = dict(tool_input)
    updated_input["model"] = SUBAGENT_MODEL
    updated_input["reasoning_effort"] = SUBAGENT_REASONING_EFFORT
    updated_input["fork_turns"] = "none"

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "allow",
                    "updatedInput": updated_input,
                }
            }
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
