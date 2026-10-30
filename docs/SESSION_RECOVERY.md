# Recovering saved sessions

After a machine restart, Overseer offers **Resume sessions** and **Clear saved sessions** for saved
sessions whose frontends are fully stopped. Resume starts the checked sessions with their
saved apps. Clear saved sessions forgets all listed sessions and their unit files, and attempts to
remove their named sign-in addresses. Both act on one click, with no confirmation, and keep
branches and worktrees. Stopping a running session still asks first.

The picker becomes a progress card as soon as either action starts. It shows elapsed time
and live command output, including login-address cleanup waits. Completion stays visible;
failed actions restore the picker so remaining sessions can be retried. Clearing saved
sessions does not start the backend. Resume starts it when the selected apps need it.

Before the first status arrives, the page says it is loading saved sessions and checking the
backend. That means checking, not an empty list or a lost session. If the first request fails,
it reports status unavailable and retries. Only a valid status with no sessions shows the empty
state. A later failed poll keeps the last good data under a stale banner.

Normal Stop removes a saved session. Frontend units are started on demand, rather than enabled
at login, so the records left after a reboot are useful recovery candidates. The panel describes
them as saved sessions; it does not claim they were running immediately before shutdown.

## Boot and state checks

Normal serve and recovery write the current Linux boot ID into each slot record. A browser
refresh or dashboard restart keeps that ID and does not count as another machine restart.
Older records without a stamp use file time compared with the boot time. No daemon or global
startup marker is needed.

Classification lives in `bin/wt`. It checks every matching unit file and canonical slot unit,
including units without files, and checks the slot's ports. Active, starting, partially running,
masked, unreadable, or legacy tab-owned sessions are excluded. Invalid paths, apps, duplicate
branches, and reserved slots cannot resume. A stopped invalid record can be forgotten only
after the independent unit guard passes.

Each preview carries a fingerprint of the saved record. Actions re-read the record and verify
both the fingerprint and its stopped state under the serve lock. The browser supplies slot
numbers and fingerprints, never commands, branches, paths, or apps to execute.

## Action boundaries

- Resume ensures the shared backend once when needed, outside the serve lock. Each selected
  slot is then validated and started under its own lock hold, in slot order. The start is pinned
  to that slot and uses its saved apps. It runs no unrelated pruning or orphan cleanup.
- Clear saved sessions validates each listed record under one lock hold before removing its stopped
  registration. Running and changed sessions are kept. It does not delete git worktrees or branches.
- A failed session does not prevent attempts on the remaining selected sessions. Results remain
  in the existing action output. A partially started session becomes a normal session card.
- Dashboard requests use the existing same-origin header check and single-action runner.
  The CLI's locked checks remain authoritative when a preview or cached status is stale.
- Named sign-in address cleanup is best effort. A failure appears in the action output;
  it does not prevent forgetting the stopped session.

The read-only command below lists candidates and prints commands for eligible actions:

```sh
~/.claude/bin/wt recover
```

Development verification uses isolated state and unit directories, fake boot IDs and ports,
and stub systemd/backend commands. It must not restore or forget real sessions as a test.
