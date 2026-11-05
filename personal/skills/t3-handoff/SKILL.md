---
name: t3-handoff
description: Continue the current work in a new T3 Code thread, then settle this one; also post messages into other T3 threads. Use when the user asks to hand off to a new or fresh thread, continue in a fresh session or copy, spawn a thread with a handoff, settle this thread, or pass a message to another T3 thread. Only works inside T3 Code on this machine.
---

# T3 handoff

`~/.claude/bin/t3-thread` drives the local T3 server: `self`, `post`, `spawn`, `settle`.
Each run mints a 5-minute token and revokes it; never print or store tokens yourself.
Do the whole flow yourself. Never hand the user text to paste.

## Hand off to a new thread

1. **Find this thread:** `self=$(~/.claude/bin/t3-thread self)`. A warning about other threads
   on the same worktree means the pick is a guess: confirm by title in
   `~/.t3/userdata/state.sqlite` (open read-only) before continuing. No result means this
   session isn't a T3 thread; stop and say so.
2. **Pick where the new thread works:**
   - Default: the same worktree and branch, with fresh context.
   - **Fresh copy** (the user says fresh copy, checkout or worktree): a new T3 worktree based on
     the current branch, so committed work carries over. Uncommitted changes do not; commit them
     on this branch first, or ask if the dirt isn't yours.
3. **Settle your own work:** wait for or stop background tasks and subagents you started, so
   nothing keeps writing after this thread settles.
4. **Write the handoff** with the `handoff` skill. Build the first message from it:

   ```bash
   msg="$(mktemp --suffix=.md)"
   { echo "Continue this work from the handoff below. Previous thread: $self."; echo; cat "$handoff_file"; } > "$msg"
   ```

5. **Spawn**, keeping the model unless the user named another:

   ```bash
   ~/.claude/bin/t3-thread spawn --from "$self" --file "$msg" --title "<short task title>"
   ```

   Fresh copy: T3's HTTP endpoint can't prepare worktrees, so `--new-worktree` refuses. Create the
   worktree with `~/.claude/bin/wt new --existing <branch>` (or a new branch), then spawn from a
   thread already in that worktree, or tell the user the new thread must be opened there.

   It prints `thread=<id>` and the title once the thread exists. On any error, stop: do not settle.
6. **Have the new thread settle this one.** T3 refuses to settle a thread mid-turn, so this thread
   can't settle itself. Post to the new thread: "once `$self` is idle, run
   `~/.claude/bin/t3-thread settle $self`".
7. Reply with the new thread's title and id, and whether it reuses this worktree or has its own.

## Post into another thread

Read that thread's recent messages first (`projection_thread_messages` in the state DB, read-only)
so you don't repeat what the user already sent. Then:

```bash
~/.claude/bin/t3-thread post <thread-id> --file message.md
```

Use `--dry-run` on `post`, `spawn` or `settle` to print the command without sending it.
