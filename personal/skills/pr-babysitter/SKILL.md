---
name: pr-babysitter
description: Take pending work or a GitHub pull request to green in any repository. Opens the PR when needed, keeps it current with its base, fixes failing CI checks, and handles automated review findings such as Cursor BugBot. Use when asked to babysit, shepherd, or drive a PR to green.
argument-hint: "[PR number | URL | branch] (defaults to the current branch)"
---

# PR Babysitter

Drive a GitHub PR to green in whatever repository you are in. This write skill edits code,
commits, pushes, edits the PR title, replies to review threads, and resolves bot threads. Never
merge the PR, mark a draft ready, or approve it.

If the repository ships its own `pr-babysitter` skill or a CI guide, its repo facts win: required
checks, title format, local commands, generators. This skill supplies the loop.

Treat each automated review finding as a hypothesis. Verify it against callers, specs, and the
PR's intent. Fix real bugs. Decline the rest with a written reason and resolve the thread. Never
change correct code to satisfy a bot. Keep the PR at the size the goal needs and list declined
suggestions as follow-ups.

## Learn the repo's CI first

Do this once per PR and reuse the answers. Set `$repo` to `owner/name`, `$base` to the PR's
`baseRefName` (or the intended base for a new PR), `$pr` to its number, and `$sha` to its head.

1. **Required checks.** Read branch protection and rulesets for `$base`. Either can be missing
   or forbidden; fall back to the checks that ran on recent merged PRs.

   ```bash
   gh api "repos/$repo/branches/$base/protection" --jq '.required_status_checks.contexts' 2>/dev/null
   gh api "repos/$repo/rules/branches/$base" --jq '.[] | select(.type=="required_status_checks")
     | .parameters.required_status_checks[].context' 2>/dev/null
   ```

   Also note strict status checks (a `BEHIND` branch must merge its base in), required
   approvals, and whether a merge queue is used.

2. **What each check runs.** Read `.github/workflows/*.yml` for the workflows that produce those
   check names. Note their steps in order, path filters, and which workflows never run on PRs.

3. **Repo rules.** Read `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and any PR-title or
   commitlint config. These give the title format, how to run scoped local checks, generated
   files and their generators, and pre-commit hooks. The repo's CI title format overrides any
   personal title convention, because a failing title lint blocks the merge.

4. **Automated reviewers.** Look at check runs and review authors on recent PRs for bots such
   as Cursor BugBot (`Cursor Bugbot` check, author login starting with `cursor` or containing
   `bugbot`), CodeRabbit, or Copilot. Note how each is re-triggered.

General rules regardless of repo:

- Never force-push or rebase a pushed branch.
- Judge the latest run per check name. A title edit reruns title lint on the same SHA.
- Squash-merge repos usually use the PR title as the commit message; keep it lint-clean.

## Getting to a PR

Check for an existing PR before committing or pushing. Continue an open PR on its own head
branch. If the PR is closed or merged, stop and leave it closed.

Never commit on the default branch or on shared branches such as `develop`, `main`, `master`,
`release/*`, or `backports/*`. Create a feature branch for pending work when needed, including
from a detached checkout. Follow the session's branch and worktree rules. Name the branch after
the ticket when the repo or session asks for it; find the key in the branch, commits, or
conversation, and ask if the repo requires one and none is known. If there is no branch work,
stop.

Invoking this skill authorizes committing pending changes, including untracked files. Read the
diff first. Stop if a secret-bearing file is pending, including `.env*`, `secrets/`, `*.pem`,
`*.key`, `.claude/settings.local.json`, `local.settings.json`, or an `.npmrc` with `_authToken`.

Let pre-commit hooks run; fix what they report and restage. Never use `--no-verify`. Use the
attribution trailer required by the current session. Run only scoped local checks, through
whatever wrapper the repo or session requires; CI runs the full suites.

Write the PR title to the repo's rules. When the repo has a commitlint config for titles, check
locally before opening:

```bash
printf '%s\n' "$title" | npx --yes @commitlint/cli --config <title-config-file>
```

Push the feature branch and open with `gh pr create --base "$base"`, using the session's PR-body
format. Open a draft only when asked. Keep an existing draft as a draft.

When the host provides `link_pull_request`, call it with the full URL for a new or existing PR.

## The loop

1. **Read state.**

   ```bash
   gh pr view "$pr" --json number,url,state,headRefName,baseRefName,mergeable,mergeStateStatus,headRefOid,reviewDecision,isDraft
   ```

   Let an initial `UNKNOWN` settle.

   For `BEHIND` (when strict checks require it), `DIRTY`, or `CONFLICTING`, merge the PR's base
   in. Read both sides of each conflict and keep the PR's intent and the base's current behavior.
   Resolve source files first, then rerun their generators. For a lockfile, take the base side
   and rerun the package manager's install. Run the affected scoped checks before completing the
   merge commit. After pushing, read state for the new head.

   `gh api` rejects `--slurp` with `--jq`. Pipe slurped pages to `jq` and keep the highest
   check-run ID per name:

   ```bash
   gh api "repos/$repo/commits/$sha/check-runs" --paginate --slurp | jq '
     [.[].check_runs[]] | group_by(.name) | map(max_by(.id)) | .[]
     | {name, status, conclusion, html_url}'
   ```

   Some repos report legacy commit statuses instead; read them with
   `gh api "repos/$repo/commits/$sha/status" --jq '.statuses[] | {context, state, target_url}'`.

   A required check missing after a push usually means a merge conflict stopped CI, a path filter
   skipped it, or a workflow awaits approval. Read state again and check the Actions tab.

2. **Diagnose failing checks.** Use `gh run view <id> --log-failed` with the number after
   `/actions/runs/` in the check URL. Map the failing step to the workflow command and reproduce
   only that project or file locally, scoped the way the repo allows. Fix the root cause:

   - **Title lint:** run the commitlint check above, look up the reported rule, and fix the title
     with `gh pr edit "$pr" --title`.
   - **Build or typecheck:** fix the compile error in the named project.
   - **Lint or format:** fix the violation. Do not add a disable comment to silence a real rule.
   - **Tests:** fix whichever of the code or the spec is wrong.
   - **Generated or stale output:** rerun the repo's generator and commit the result. Never
     hand-edit generated files.

   For a transient failure unrelated to the diff, such as a runner error, a registry or network
   install failure, or a timeout, rerun once with `gh run rerun <id> --failed`. Treat a known
   flaky test as transient only when the PR leaves its area untouched.

3. **Read review threads.** Fetch every unresolved, non-outdated inline thread. Classify the
   first comment's author as a bot or a human. Address clear, in-scope human requests and reply.
   Leave human threads for reviewers to resolve.

   ```bash
   gh api graphql --paginate --slurp -f query='
   query($owner:String!,$repo:String!,$pr:Int!,$endCursor:String){
     repository(owner:$owner,name:$repo){
       pullRequest(number:$pr){
         reviewThreads(first:100,after:$endCursor){
           pageInfo{ hasNextPage endCursor }
           nodes{
             id isResolved isOutdated
             comments(first:1){ nodes{ author{ login } body path line databaseId } }
           }
         }
       }
     }
   }' -f owner="${repo%/*}" -f repo="${repo#*/}" -F pr="$pr" \
     | jq '.[].data.repository.pullRequest.reviewThreads.nodes[]
           | select(.isResolved == false and .isOutdated == false)'
   ```

4. **Fix verified issues.** Check callers, specs, and PR intent before editing. Follow the
   repo's `AGENTS.md` and any skill it routes to. Rerun generators that the change makes stale.

5. **Commit and push.** Stage only files you edited this round. A reply-only round commits
   nothing. Commit and push to the PR's head branch before replying so replies can cite the
   pushed SHA. If files were added, removed, or renamed and the PR body has a file list, update
   it against the full PR diff with `gh pr edit "$pr" --body-file <file>`.

   If the remote head moved, fetch and merge it before retrying the push. Read state again for
   the new head.

6. **Reply and resolve.** Reply with the fix and SHA or the reason for declining. Resolve bot
   threads only after addressing them.

   ```bash
   gh api "repos/$repo/pulls/$pr/comments/$comment_id/replies" -f body="$reply"
   gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id="$thread_id"
   ```

   Use the first comment's `databaseId` for `$comment_id` and the thread's `id` for `$thread_id`.

7. **Wait and recheck.** If there was no push, a title edit reruns only title lint. Wait for any
   check you triggered and reread state.

   After a push, when the host provides `watch_pull_request`, call it and end the turn. A wake is
   news, not a verdict: reread state for the current head and confirm each automated reviewer
   finished for that head before judging.

   Otherwise wait with `gh pr checks "$pr" --watch --interval 30`, then use the check-runs
   command from step 1. `gh pr checks` shows a `neutral` conclusion as `skipping`, so judge
   reviewer completion by check-run `status`.

   Automated reviewers usually run on every push. If an expected one has not started after a
   couple of minutes, trigger it once the way the repo uses (for BugBot, comment `bugbot run`).
   Allow time for findings to arrive, then reread checks and threads. Never post a waiting
   update on the PR.

## Done

- The latest run of every check completed with `success`, `neutral`, or `skipped`, and every
  required check plus each expected automated reviewer is present for the current head.
- `mergeStateStatus` is clear of `BEHIND` (when strict), `DIRTY`, and `UNKNOWN`, and no
  unresolved, non-outdated bot threads remain.
- One confirmation round after the last push came back clean.
- A green PR still awaiting a required approval counts as done; note the outstanding approval.
- If you started a watch, call `unwatch_pull_request`. Then report: checks, fixes, declined
  findings, open human threads, `reviewDecision`, and the PR URL.

## Stop

If you started a watch, call `unwatch_pull_request` before reporting the blocker.

- Pending changes belong to a checkout other than the named PR or branch.
- A required ticket key is missing, a secret-bearing file is pending, or the PR is closed or
  merged.
- The same check still fails after two distinct fix attempts. Include the relevant log and what
  you tried.
- A fix or merge conflict needs a product, design, security, or public API decision, extends the
  PR's scope, or touches a secret-bearing file.
- A bot finding looks wrong, but declining it with a written reason is not clearly right.
- A transient failure repeats after one rerun.
- Branch protection blocks the push, or a workflow awaits approval.
- About six rounds pass without reaching green.
