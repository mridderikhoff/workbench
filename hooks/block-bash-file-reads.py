#!/usr/bin/env python3
"""PreToolUse (Bash) hook: deny a recursive shell search rooted at the project
root, and say how to rescope it.

Rationale (verified on Claude Code 2.1.259, headless default mode): the
harness stops for approval on `grep -r X .`, a path-less `grep -r X`, `rg X .`,
and `cd dir && grep -r X .`, because the root scope is covered by a Read()
deny rule such as Read(**/.env). The same search scoped to a named
subdirectory (`grep -r X apps/`, `rg X cicd/`), `git grep`, `find`, globbed
`cat`, and literal-path reads all run without a prompt, so they are allowed.

The hook fails OPEN: any parsing error allows the command, so it can never
wedge a workflow — worst case is the pre-existing prompt. Set
BLOCK_BASH_FILE_READS=0 to bypass it when measuring the harness itself.
"""
import json
import os
import re
import shlex
import sys

STATEMENT_SEPS = {";", "&&", "||", "&", "\n", "(", ")", "{", "}", "|"}
PREFIXES = {"sudo", "nice", "nohup", "command", "env", "time", "exec", "then",
            "do", "else", "!"}
ROOT_OPERANDS = {".", "./", "*", "./*"}


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def allow():
    sys.exit(0)


def tokenize(cmd):
    if "<<" in cmd:
        lex = shlex.shlex(cmd, posix=True, punctuation_chars=True)
        lex.whitespace_split = True
        return list(lex)
    tokens = []
    for i, line in enumerate(cmd.split("\n")):
        if i:
            tokens.append("\n")
        lex = shlex.shlex(line, posix=True, punctuation_chars=True)
        lex.whitespace_split = True
        tokens.extend(lex)
    return tokens


def strip_prefixes(tokens):
    i = 0
    while i < len(tokens):
        t = tokens[i]
        if re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", t) or t in PREFIXES:
            i += 1
            continue
        if t == "timeout":
            i += 1
            if i < len(tokens) and re.match(r"^[0-9]", tokens[i]):
                i += 1
            continue
        break
    return tokens[i:]


def is_recursive_grep(cmd, args):
    if cmd in ("rg", "ripgrep", "rgrep"):
        return True
    if cmd in ("grep", "egrep", "fgrep"):
        return any(a == "--recursive" or
                   (a.startswith("-") and not a.startswith("--") and re.search(r"[rR]", a))
                   for a in args)
    return False


def path_operands(args):
    value_flags = {"-e", "-f", "-m", "-A", "-B", "-C", "-g", "-t", "-T",
                   "--include", "--exclude", "--exclude-dir", "--glob", "--type"}
    ops, skip = [], False
    for a in args:
        if skip:
            skip = False
            continue
        if a in value_flags:
            skip = True
            continue
        if a.startswith("-") and a != "-":
            continue
        ops.append(a)
    return ops[1:]  # drop the pattern


def inspect_stage(tokens, after_cd, piped_in):
    tokens = strip_prefixes(tokens)
    if not tokens or piped_in:
        return None
    cmd = tokens[0].rsplit("/", 1)[-1]
    args = tokens[1:]
    if not is_recursive_grep(cmd, args):
        return None
    paths = path_operands(args)
    if not paths or any(p in ROOT_OPERANDS for p in paths):
        return "rooted at the project root"
    if after_cd:
        return "run after a cd, so its scope cannot be resolved"
    return None


def main():
    if os.environ.get("BLOCK_BASH_FILE_READS") == "0":
        allow()
    try:
        payload = json.load(sys.stdin)
    except Exception:
        allow()
    if payload.get("tool_name") != "Bash":
        allow()
    cmd = (payload.get("tool_input") or {}).get("command", "")
    if not cmd or not cmd.strip():
        allow()
    try:
        tokens = tokenize(cmd)
    except Exception:
        allow()

    stage, after_cd, piped_in, hit = [], False, False, None
    for tok in tokens + ["\n"]:
        if tok in STATEMENT_SEPS:
            if stage:
                if hit is None:
                    hit = inspect_stage(stage, after_cd, piped_in)
                if strip_prefixes(stage)[:1] == ["cd"]:
                    after_cd = True
            piped_in = tok == "|"
            stage = []
            continue
        stage.append(tok)

    if hit:
        deny(
            f"Blocked: this recursive search is {hit}, which Claude Code stops "
            f"for approval against the Read() deny rules. Rescope it to a named "
            f"subdirectory (grep -r X apps/, rg X cicd/) from the worktree root, "
            f"or use git grep; use Read for a known file; delegate a broad search "
            f"to an Explore subagent."
        )
    allow()


if __name__ == "__main__":
    try:
        main()
    except Exception:
        sys.exit(0)
