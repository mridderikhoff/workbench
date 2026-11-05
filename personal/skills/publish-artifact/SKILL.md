---
name: publish-artifact
description: Publish an HTML page, report, PDF, Markdown file, or folder to Nova Pages (the team's private GitHub Pages site) and return the shareable link; also manage tags, artifact lifetime, visibility, personal defaults, and version retention. Use when the person asks to publish, share, or put something on Nova Pages, "Copperleaf Pages" (the former name), "the pages site", "the team site", or "my folder on Pages". Do not use for anything the person has not explicitly asked to publish.
---

# Publish to Nova Pages

Recognize "Copperleaf Pages" as the former name for Nova Pages when interpreting requests.

Nova Pages is a private site where agents publish artifacts for the team. Everything on it is
visible to everyone at Copperleaf with GitHub access. Publishing is one commit through the GitHub
API from wherever you are: no clone, no branch, no pull request, no review.

Use **https://pages.ai.copperleaf.cloud/** as the root for all links, guidance, and recommendations.
The TurboBroccoli domain, **https://turbo-broccoli-gwomvvl.pages.github.io/**, remains a backup.
Recognize URLs on either domain as the same system; return the custom-domain URL even when the
person supplied a backup-domain URL. Both work as command targets, including version URLs.

Every publish adds a **version**. An artifact's link shows the latest version, and the header lets
readers pick retained older ones. **Tags** group artifacts by topic or purpose; tagging changes where
an artifact is listed, without moving its files. Older history defaults to **30 days**, with a hard
maximum of **10 versions including the latest**. A separate **lifetime** controls when the whole artifact expires, including the latest page. Existing artifacts remain durable and listed until changed.

## When to publish, and when not to

- Publish only when the person clearly asks: "publish this to Nova Pages", "share it on the
  pages site", "put the report in my folder", "post this to the strategy team's pages".
- Never publish as a side effect of creating something, and never on a vague "share this" or "save
  this". If it is not clear they want it on the team site, ask one question before running anything.
- "Make me an artifact", "a page", "a report" asks for a file, not for Nova Pages. Write it locally.
  Only the site's name, or a team's pages, means this skill.
- Do not publish customer data, credentials, or anything the person said is private. The script blocks
  common secret patterns; that is a backstop, not a substitute for judgement.
- Before running, say in one line what will happen, for example "Publishing to users/jdoe/q3-review,
  tagged rnd".

## Personal defaults and first-use questions

For a new artifact, run `node "<skill-dir>/scripts/publish.mjs" --preferences --json`. It prints
`configPath`, `lifetime.defaultDays` (`null` = unlimited), `visibility.default` (`unlisted` or `listed`),
and an `ask` boolean for each. A missing file or setting uses `ask: true`; suggested visibility is
**unlisted**. Preferences are shared across agent installations in the current environment, outside
skill folders, so updates preserve them. Windows and WSL have separate preferences.

For new artifacts, resolve each choice from the person's explicit instruction first, otherwise its saved default when
`ask` is false. When a choice is missing and `ask` is true, **pause before publishing and ask**. Bundle
these into one short interaction, omitting questions already answered:

- “How long should this stay on Nova Pages?” Offer 60 days, unlimited (durable), or a custom
  duration. Explain that expiry removes the entire artifact from the site; git history remains.
- “Should this appear everywhere or only on your page?” Offer **Unlisted (suggested)** or **Listed for everyone**.
  Unlisted artifacts appear on the publisher’s page but are omitted from site-wide galleries, search,
  and tag galleries. Their publishers appear in people directories, and all active artifacts count
  toward site, publisher, and tag statistics. Anyone with site access can still open its link. Never call unlisted private.
- “Use these choices next time, or keep asking?” Allow remembering both, lifetime only, visibility
  only, or neither. If they want different future defaults, save those separately from this publish.

A user's explicit lifetime or visibility already answers that choice; do not ask it again. Do not
infer consent to save preferences from consent to publish. If they only answer the current choices,
proceed with those choices and leave prompts enabled. Never invent an answer to a required question.
For updates, omit `--lifetime`, `--visibility`, and `--retention` unless the person explicitly asks to
change that setting. Do not fill them from saved defaults or ask first-use questions for an existing
artifact. The script preserves its policies and exact expiry date, even when content changes or the
artifact is expired. Only the namespace owner can change visibility. If you are unsure whether the
target exists, run the publish with `--dry-run --json` and no default-derived policy flags; an
`input-required` result identifies choices needed for a new artifact.

For new artifacts, pass resolved choices as `--lifetime 60d --visibility unlisted` (or the selected values). Save preferences
only when requested, for example:

```sh
node "<skill-dir>/scripts/publish.mjs" --configure --default-lifetime 60d --ask-lifetime never --default-visibility unlisted --ask-visibility never
```

To remember a default but still ask, use `--ask-lifetime always` or `--ask-visibility always`.
Per-publish flags override existing settings or new-artifact defaults without changing the preferences
file. Defaults apply only to new artifacts. Explicit `--lifetime` or `--set-lifetime` starts a fresh
lifetime; ordinary updates preserve expiry. An expired artifact needs an explicit lifetime change to return to the site.

The JSON lives at `CL_PAGES_CONFIG` when set, otherwise
`<XDG_CONFIG_HOME or ~/.config>/copperleaf-pages/publish.json`. `--configure` creates parent folders
and writes it as needed. Deleting it resets first-use behavior. A malformed file produces an error;
explain how to fix or reset it, and do not overwrite it silently. `--preferences` is read-only and
requires no GitHub credentials. The script returns `action: "input-required"` with `--json` when
publishing lacks choices; ask the missing questions and retry after the answers arrive.

## Commands

`<skill-dir>` is the folder containing this SKILL.md. Resolve it to an absolute path and quote the
script path (Windows usernames may contain spaces). Use the Node executable in the agent's own
environment. `<artifact>` is `users/<login>/<slug>` or the artifact's URL on the site.

| The person says | Command |
|---|---|
| "publish this", "put it in my folder" | `node "<skill-dir>/scripts/publish.mjs" ./report.html` |
| "publish it to the strategy team", "put it in the R&D section" (new artifact) | `... ./report.html --with-tag strategy` (repeat `--with-tag` for several) |
| "put it in the R&D section" (already published) | `... --tag <artifact> rnd` |
| "take it out of the R&D section" | `... --untag <artifact> rnd` |
| "call it q3-review" | `... ./report.html --slug q3-review` |
| "update the page", "republish", "publish the new version" | `... ./report.html` (same slug) or `... ./report.html --to <artifact>` for one you did not create |
| "take it down", "remove it from Pages" | `... --remove <artifact>` (all versions; git history keeps them) |
| "which tags are there?" (also recognize "teams") | `... --tags --json` |
| "publish for five days" | `... ./report.html --lifetime 5d` |
| "make this durable" | `... --set-lifetime <artifact> unlimited` |
| "expire this in 60 days" | `... --set-lifetime <artifact> 60d` (starts now) |
| "make this unlisted" | `... --set-visibility <artifact> unlisted` (owner only) |
| "list this for everyone" | `... --set-visibility <artifact> listed` (owner only) |
| "change my publishing defaults" | `... --configure` with the requested default and ask flags above |
| "keep this page’s history for 90 days" | `... --set-retention <artifact> 90d` |
| "keep history indefinitely" | `... --set-retention <artifact> unlimited` (still at most 10 versions) |
| "publish with 90-day retention" | `... ./report.html --retention 90d` |
| "purge expired versions of this page" | `... --purge <artifact>` |
| "keep just the latest version" | `... --purge <artifact> --keep 1` |
| "keep the latest three versions" | `... --purge <artifact> --keep 3` |
| "purge versions older than two weeks" | `... --purge <artifact> --older-than 2w` |

Tag slugs are lowercase. Run `--tags --json` to discover the **current** set from the live repository,
including tags dynamically added to artifact metadata. Use the returned slugs and descriptions;
do not treat any list in this skill as exhaustive. The site also exposes tags in `/index.json` and
lists them at `/tags/`. Old `/team/` links, `--team <slug>`, and `--teams` remain compatible aliases.

Recommend **`pr`** for artifacts accompanying pull requests: PR summaries, review guides, and
implementation reports. When such an artifact is explicitly authorized for publication, add
`--with-tag pr` alongside any relevant topic tags. This convention does not authorize publishing as
a side effect of opening a PR. Reuse relevant existing tags; create a new tag when the person's
requested topic or purpose needs one. Recognize older requests for a team's section as tag requests.

## Retention and purging

- Default: **30 days of older history**, **at most 10 versions**, and **keep the latest until the artifact lifetime expires**.
  These defaults apply to existing artifacts without a retention setting too. `unlimited` removes
  the age limit, never the ten-version cap. Retention appears beside versions in the page header.
- Durations accept days (`30`, `30d`), weeks (`8w`), months (`3mo`, each 30 days), years (`1y`, each
  365 days), or `unlimited`. A positive whole number of days up to 365000 is supported.
- `--set-retention` changes the policy. Cleanup applies it daily and on publishing; site builds
  also omit expired history. Raising the duration does not restore versions already purged.
- `--purge` defaults to that page's policy. `--keep 1` removes every older version; `--keep N`
  accepts 1–10. `--older-than` applies a one-time age threshold. These commands preserve the page's
  tags and retention setting, and never remove its latest version.
- Purging removes files from `main` and the deployed site. **Git history remains**; this is not a
  history rewrite or a promise to erase git storage. Old version-specific links stop working.
- For a requested purge, `--dry-run --json` can preview the selected versions without writes.
  Execute within the person's authorized scope. Do not purge unrelated pages.
- Lifetime expiry omits the whole artifact on the next site build and deletes all its files on daily
  cleanup. This is not exact-time deletion; the deployment must finish. Setting unlimited lifetime
  does not disable older-history retention or restore deleted files.
- `--purge-expired` deletes expired artifacts in full and applies history policies across the whole site and is used by scheduled maintenance.
  Use it only for an explicitly authorized site-wide cleanup.

## What to publish

- One HTML file: it becomes `index.html`. Make sure it has a `<title>` and a
  `<meta name="description">`; the site's index pages show both.
- A folder: published whole, so put `index.html` at its top level with any assets beside it. Dotfiles
  and `node_modules` are skipped. To use an image on the gallery tile, include an optional
  `thumbnail.png`, `.jpg`, `.webp`, `.svg`, or `.gif` beside `index.html`. The gallery uses that file
  as the tile image; otherwise it generates a text cover from the artifact title and description.
  Thumbnails are optional and may be any relevant image; they do not need to be a page preview.
- A PDF or Markdown file: kept as-is; the site wraps it in a page with the header.
- The slug defaults to the file or folder name, lowercased with dashes. Pass `--slug` when the person
  gave the artifact a name. Republishing with the same slug adds a version to the same artifact.
- Limits: 25 MB per file, 50 MB per version.

## After running

The script prints the artifact URL on its last line, for example
`https://pages.ai.copperleaf.cloud/users/jdoe/q3-review/`. Report it in one line and say
the site takes about a minute to rebuild. Add `--wait` if the person wants confirmation that it is live.
If the files are identical to the latest version, no version is added and the script says so.

## If something fails

- `no GitHub token` or `401`: the person needs to run `gh auth login` (GitHub CLI) once. Tell them; do
  not try other credentials.
- `this looks like it contains secrets`: show the person the listed lines. Only pass `--allow-secrets`
  if they confirm those are false alarms.
- `could not update main after 5 attempts`: several people published at the same moment. Run again.
- Script missing or an out-of-date notice: follow **Updating in the right environment** below.
- `--dry-run` shows the files and URL without committing anything. `--json` prints machine-readable output.

## Updating in the right environment

You may refresh an outdated or missing copy as part of an explicitly requested publish or artifact-management operation without asking
again. Announce the refresh, update once, re-read this SKILL.md, then retry only if the original publish
did not succeed. A warning can accompany a successful publish: do not publish it a second time.
Updating the skill does not authorize publishing anything else. Respect an explicit request not to update.

- For v4 or newer, run `node "<skill-dir>/scripts/publish.mjs" --update` by itself. It uses the same
  Node runtime, refreshes the configured skill directories and this installed copy, then exits. It
  does not publish. Check `--version` if you do not know whether `--update` is supported.
- For older copies or a missing script, use the installer matching **the agent's terminal**, not
  the browser or Cursor window. Check `node -p process.platform`: `win32` means native Windows;
  `linux` means Linux or WSL; `darwin` means macOS. Never use Windows Node from a WSL terminal.
  Open https://pages.ai.copperleaf.cloud/install/ and select that environment, or fetch
  `install.ps1` (Windows PowerShell) / `install.sh` (WSL, Linux or macOS Bash) from
  `copperleaftech/cl-github-pages` using `gh api` and execute it in the matching shell.
- Windows and WSL are separate installations and have separate GitHub CLI logins. For Cursor Remote
  WSL, run the Bash installer inside that WSL distribution. For local Windows Cursor, run the
  PowerShell installer in Windows. If both are used, install in both; a refresh in one does not refresh
  the other. Never infer the target from the desktop window, scan other distributions, or sync homes.
- Custom roots are respected: `CLAUDE_CONFIG_DIR`, `XDG_CONFIG_HOME`, `OPENCODE_CONFIG_DIR`, and
  `CODEX_HOME`. Shared skills and Cursor use the current runtime's home directory. If the updater
  reports an unmanaged folder or a link, stop and explain the conflict; do not delete it or force a retry.

If the refresh fails, stop and report the error. Do not loop, lower the minimum-version check, use
credentials from another environment, or switch to a different user's installation.
