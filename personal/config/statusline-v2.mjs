#!/usr/bin/env node
// Reads Claude Code statusline JSON from stdin and prints a two-line, color-coded
// status line tuned for a narrow pane:
//   line 1:  [<dir> · ] ⎇ <branch> · <model>
//   line 2:  ◐ CTX nn% · 5H nn%
// The directory is dropped when it just repeats the branch tail (the worktree case)
// and the "mridderikhoff/" owner prefix is stripped, so the context/rate meters on
// line 2 are never pushed off-screen.
// Each segment is omitted when data is unavailable.
// Colors use 256-color ANSI; separators are dim so colored segments pop.

import { execFileSync } from 'node:child_process';
import { resolve, basename } from 'node:path';

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(raw.replace(/^﻿/, '') || '{}');

    // --- model ---
    const model = payload.model?.display_name ?? payload.model?.id ?? '';

    // --- directory: basename of cwd ---
    const cwd = payload.cwd ?? payload.workspace?.current_dir ?? '';
    const dir = cwd ? basename(resolve(cwd)) : '';

    // --- git branch ---
    const branch = gitBranch(cwd);

    // --- context % ---
    const ctxPct = contextPercentage(payload.context_window);

    // --- 5-hour rate limit % ---
    const fiveHour = payload.rate_limits?.five_hour;
    const fivePct = fiveHour != null ? Math.round(fiveHour.used_percentage ?? 0) : null;

    // --- line 1: location (dir + branch, deduped) and short model ---
    const OWNER_PREFIX = 'mridderikhoff/';
    const shortBranch = branch.startsWith(OWNER_PREFIX)
      ? branch.slice(OWNER_PREFIX.length)
      : branch;
    const branchTail = shortBranch.split('/').pop() ?? shortBranch;

    const line1 = [];
    // Drop the directory when it just repeats the branch's trailing segment
    // (the normal worktree case, where the folder is named after the branch).
    if (dir && dir !== branchTail) line1.push(blue(dir));
    if (shortBranch)               line1.push(magenta(`⎇ ${middleTruncate(shortBranch, 24)}`));
    if (model)                     line1.push(cyan(model));

    // --- line 2: the volatile meters, on their own line so they never truncate ---
    const line2 = [];
    if (ctxPct !== null)  line2.push(`${dim('◐')} ${dim('CTX')} ${trafficLight(ctxPct, 15, 35)}`);
    if (fivePct !== null) line2.push(`${dim('5H')} ${trafficLight(fivePct, 80, 100)}`);

    const out = [line1.join(sep(' · '))];
    if (line2.length) out.push(line2.join(sep(' · ')));
    process.stdout.write(out.join('\n'));
  } catch {
    /* swallow — produce no output on bad JSON */
  }
});

// Returns the whole-percentage of the context window in use, or null.
// Uses the pre-calculated used_percentage field when available; falls back
// to computing from current_usage / context_window_size.
function contextPercentage(ctx) {
  if (!ctx) return null;
  if (typeof ctx.used_percentage === 'number') {
    return clampPct(ctx.used_percentage);
  }
  const u = ctx.current_usage;
  const size = ctx.context_window_size;
  if (u && size > 0) {
    const tokens = (u.input_tokens ?? 0)
      + (u.cache_creation_input_tokens ?? 0)
      + (u.cache_read_input_tokens ?? 0);
    if (tokens > 0) return clampPct((tokens / size) * 100);
  }
  return null;
}

function clampPct(pct) {
  return Math.min(100, Math.max(0, Math.round(pct)));
}

// Returns the current git branch name, or an empty string on any failure.
// Uses --no-optional-locks so it never writes lock files.
function gitBranch(cwd) {
  try {
    const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] };
    if (cwd) opts.cwd = cwd;
    const out = execFileSync(
      'git',
      ['--no-optional-locks', 'rev-parse', '--abbrev-ref', 'HEAD'],
      opts
    ).trim();
    // Detached HEAD returns "HEAD" — omit it for clarity
    return out === 'HEAD' ? '' : out;
  } catch {
    return '';
  }
}

// Shortens a string to at most max chars, keeping the head and tail and
// dropping the middle to an ellipsis: e.g. a long branch -> "docume…er-plan".
function middleTruncate(s, max) {
  if (s.length <= max) return s;
  const keep = max - 1;              // one char reserved for the ellipsis
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${s.slice(0, head)}…${s.slice(s.length - tail)}`;
}

// --- ANSI helpers ---
// All sequences use 256-color (38;5;n) foreground + dim (2m) to keep them muted.
// Reset is always \x1b[0m.

const R = '\x1b[0m';

// 256-color fg without dim — desaturated pastel shades keep the muted look
// while staying clearly visible.
function c256(n, text) { return `\x1b[38;5;${n}m${text}${R}`; }

// Separator: just dim, no hue
function sep(text)     { return `\x1b[2m${text}${R}`; }
function dim(text)     { return `\x1b[2m${text}${R}`; }

// Segment colors — muted pastels (no dim attribute)
function cyan(text)    { return c256(116, text); }  // soft steel cyan
function blue(text)    { return c256(110, text); }  // soft slate blue
function magenta(text) { return c256(140, text); }  // soft purple

// Traffic-light with per-segment thresholds: green < warnAt, orange < dangerAt, red >= dangerAt.
// CTX uses (15, 35); 5H uses (80, 100).
// Slightly brighter than the label dim so the number itself draws the eye.
function trafficLight(pct, warnAt, dangerAt) {
  const s = `${pct}%`;
  if (pct >= dangerAt) return `\x1b[38;5;167m${s}${R}`;  // muted red
  if (pct >= warnAt)   return `\x1b[38;5;208m${s}${R}`;  // orange
  return                 `\x1b[2;38;5;65m${s}${R}`;      // dim desaturated green — blends with labels
}
