#!/usr/bin/env node
// Publishes a folder or file to the Nova Pages site with one commit through the
// GitHub API. No clone, no branch, no pull request. Every publish adds a new version;
// Older versions are pruned by retention policy; git history remains. Node 18+, standard library only. Auth: `gh auth token` or GITHUB_TOKEN.
//
// Run --help for publishing, live tags, retention and purge commands.
// Canonical links use pages.ai.copperleaf.cloud; the TurboBroccoli domain is accepted as a backup.
// Each publish adds a version, with at most 10 versions and 30 days of older history by default.
// Installed copies below tools/publish-version.json's minimum must refresh their skill.

import { artifactTags, artifactExpired, lifetimeMetadata, expiredVersions, parseRetention, retentionDays, VERSION_ID } from './retention.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = process.env.CL_PAGES_REPO || 'copperleaftech/cl-github-pages';
const BRANCH = 'main';
const SITE_PRIMARY = 'https://pages.ai.copperleaf.cloud';
const SITE_BACKUP = 'https://turbo-broccoli-gwomvvl.pages.github.io';
const API = 'https://api.github.com';
const MAX_FILE = 25 * 1024 * 1024;
const MAX_TOTAL = 50 * 1024 * 1024;
const RETRIES = 5;
const INSTALL_CMD = `node "${fileURLToPath(import.meta.url)}" --update`;
// Bump on incompatible changes and raise "min" in tools/publish-version.json to retire older copies.
const VERSION = 9;

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const flags = { tags: [] };
const positional = [];
const fail = (msg) => { console.error(`publish: ${msg}`); process.exit(1); };
const note = (msg) => { if (!flags.json) console.error(msg); };
function value(i, name) {
  if (!argv[i + 1] || argv[i + 1].startsWith('--')) fail(`missing value for --${name}`);
  return argv[i + 1];
}
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--help' || a === '-h') { usage(); process.exit(0); }
  if (a === '--version') { console.log(`publish.mjs v${VERSION}`); process.exit(0); }
  if (!a.startsWith('--')) { positional.push(a); continue; }
  const name = a.slice(2);
  if (name === 'team' || name === 'with-tag') { flags.tags.push(value(i, name)); i++; }
  else if (['slug', 'message', 'to', 'remove', 'purge', 'retention', 'keep', 'older-than', 'lifetime', 'visibility', 'default-lifetime', 'default-visibility', 'ask-lifetime', 'ask-visibility'].includes(name)) { flags[name] = value(i, name); i++; }
  else if (name === 'tag' || name === 'untag' || name === 'set-retention' || name === 'set-lifetime' || name === 'set-visibility') {
    const artifact = value(i, name); i++;
    if (['set-retention', 'set-lifetime', 'set-visibility'].includes(name)) { flags[name] = { artifact, duration: value(i, name) }; i++; }
    else {
      flags[name] = { artifact, teams: [] };
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) flags[name].teams.push(argv[++i]);
    }
  } else if (name === 'tags') flags.listTags = true;
  else if (['teams', 'whoami', 'update', 'wait', 'dry-run', 'allow-secrets', 'json', 'purge-expired', 'preferences', 'configure'].includes(name)) flags[name] = true;
  else fail(`unknown option --${name}; use --help`);
}
const commands = ['preferences', 'configure', 'set-lifetime', 'set-visibility', 'tag', 'untag', 'remove', 'purge', 'set-retention', 'purge-expired', 'whoami', 'teams', 'listTags', 'update'];
// --tags lists tags; publishing uses repeatable --with-tag.
if (commands.filter(k => flags[k]).length > 1) fail('run one command at a time');
if (commands.some(k => flags[k]) && positional.length && !flags.update) fail('run one command at a time');
if ((flags.keep || flags['older-than']) && !flags.purge) fail('--keep and --older-than require --purge');
if (flags.keep && flags['older-than']) fail('choose --keep or --older-than');
if ((flags.tags.length || flags.to || flags.slug) && (commands.some(k => flags[k]) || positional.length !== 1)) fail('--with-tag, --team, --to and --slug require a file or folder to publish');
if (flags.retention && (positional.length !== 1 || commands.some(k => flags[k]))) fail('--retention requires a file or folder to publish');
if (flags.keep && (!/^[1-9]\d*$/.test(flags.keep) || Number(flags.keep) > 10)) fail('--keep must be an integer from 1 to 10; the latest version is always kept');
for (const duration of [flags.retention, flags['older-than'], flags['set-retention']?.duration, flags.lifetime, flags['default-lifetime'], flags['set-lifetime']?.duration].filter(Boolean)) {
  try { parseRetention(duration); } catch (e) { fail(e.message); }
}

for (const key of ['lifetime', 'visibility']) {
  if (flags[key] && (positional.length !== 1 || commands.some(k => flags[k]))) fail(`--${key} requires a file or folder to publish`);
}
for (const key of ['default-lifetime', 'default-visibility', 'ask-lifetime', 'ask-visibility']) {
  if (flags[key] && !flags.configure) fail(`--${key} requires --configure`);
}
const normalizeVisibility = (visibility) => visibility === 'hidden' ? 'unlisted' : visibility;
for (const key of ['visibility', 'default-visibility']) if (flags[key]) flags[key] = normalizeVisibility(flags[key]);
if (flags['set-visibility']) flags['set-visibility'].duration = normalizeVisibility(flags['set-visibility'].duration);
for (const visibility of [flags.visibility, flags['default-visibility'], flags['set-visibility']?.duration].filter(Boolean)) {
  if (!['unlisted', 'listed'].includes(visibility)) fail('Visibility must be unlisted or listed.');
}
for (const key of ['ask-lifetime', 'ask-visibility']) {
  if (flags[key] && !['always', 'never'].includes(flags[key])) fail(`--${key} must be always or never`);
}

// A shared personal file outside skill directories survives installer replacement.
// CL_PAGES_CONFIG also makes automation and tests independent of personal preferences.
const configPath = path.resolve(process.env.CL_PAGES_CONFIG || path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'copperleaf-pages', 'publish.json'));
function readPreferences() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw new Error(`Cannot read preferences at ${configPath}: ${error.message}. Fix the file or delete it to reset.`);
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved) || (saved.version !== undefined && saved.version !== 1)) throw new Error(`Invalid preferences at ${configPath}; expected a version 1 object.`);
  const result = { ...saved, version: 1 };
  for (const [key, defaults] of Object.entries({ lifetime: { defaultDays: null, ask: true }, visibility: { default: 'unlisted', ask: true } })) {
    if (saved[key] !== undefined && (!saved[key] || typeof saved[key] !== 'object' || Array.isArray(saved[key]))) throw new Error(`Invalid ${key} preferences at ${configPath}.`);
    result[key] = { ...defaults, ...saved[key] };
    if (typeof result[key].ask !== 'boolean') throw new Error(`Invalid ${key}.ask at ${configPath}; expected true or false.`);
  }
  const days = result.lifetime.defaultDays;
  if (days !== null && (!Number.isSafeInteger(days) || days < 1 || days > 365000)) throw new Error(`Invalid lifetime.defaultDays at ${configPath}.`);
  result.visibility.default = normalizeVisibility(result.visibility.default);
  if (!['unlisted', 'listed'].includes(result.visibility.default)) throw new Error(`Invalid visibility.default at ${configPath}.`);
  return result;
}
function savePreferences(prefs) {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const temporary = `${configPath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(prefs, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, configPath);
  } finally { fs.rmSync(temporary, { force: true }); }
}
if (flags.preferences || flags.configure) {
  try {
    const prefs = readPreferences();
    if (flags['default-lifetime']) prefs.lifetime.defaultDays = parseRetention(flags['default-lifetime']);
    if (flags['default-visibility']) prefs.visibility.default = flags['default-visibility'];
    if (flags['ask-lifetime']) prefs.lifetime.ask = flags['ask-lifetime'] === 'always';
    if (flags['ask-visibility']) prefs.visibility.ask = flags['ask-visibility'] === 'always';
    if (flags.configure && !flags['dry-run']) savePreferences(prefs);
    console.log(JSON.stringify({ configPath, ...prefs }, null, 2));
    process.exit(0);
  } catch (error) { fail(error.message); }
}

function usage() {
  console.log(`Publish to Nova Pages (${SITE_PRIMARY})
  publish.mjs <file-or-folder> [--with-tag <slug>]... [--slug <slug>] [--to <artifact>] [--retention <duration>]
  publish.mjs --tag <artifact> <tag>...       Add tags
  publish.mjs --untag <artifact> <tag>...     Remove tags
  publish.mjs --tags                        List current tags from the live repository
  publish.mjs --set-retention <artifact> <duration>
  publish.mjs --purge <artifact> [--keep <count> | --older-than <duration>]
  publish.mjs --purge-expired               Apply each artifact's policy across the site
  publish.mjs --remove <artifact>           Remove the artifact and all versions
  publish.mjs --set-lifetime <artifact> <duration>
  publish.mjs --set-visibility <artifact> unlisted|listed  Owner only
  publish.mjs --preferences                 Read personal defaults (no GitHub access)
  publish.mjs --configure [--default-lifetime <duration>] [--default-visibility unlisted|listed]
                         [--ask-lifetime always|never] [--ask-visibility always|never]
  publish.mjs --whoami | --version | --update

Durations: days (30 or 30d), weeks (8w), months (3mo = 90 days), years (1y), unlimited.
Publish options: --lifetime <duration>, --visibility unlisted|listed override existing settings or new-artifact defaults.
First use requires lifetime and visibility choices; the agent asks and can save defaults with --configure.
Unlisted artifacts appear on their publisher's page only; everyone with site access can still open their direct links.
Updates preserve visibility, lifetime, expiry and history retention unless explicitly changed. Unlimited lifetime keeps it durable.
Preferences: CL_PAGES_CONFIG or <XDG_CONFIG_HOME or ~/.config>/copperleaf-pages/publish.json.
Delete that file to reset prompts. Settings survive skill updates.
Default history retention: 30 days. Maximum: 10 versions, even with unlimited retention. The latest is kept until the artifact lifetime expires.
Purge defaults to the page's retention; --keep 1 removes every older version.
Purged files leave main and the site; git history remains.
<artifact>: users/<login>/<slug> or a URL on the primary or TurboBroccoli backup domain.
Options: --dry-run, --json, --wait, --message <text>, --allow-secrets.
Compatibility aliases: --team <slug> for --with-tag; --teams for --tags.`);
}

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

function token() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try { return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return fail('no GitHub token. Run `gh auth login` (GitHub CLI) or set GITHUB_TOKEN.'); }
}
const TOKEN = token();

async function api(method, url, body, { okStatus = [] } = {}) {
  const res = await fetch(url.startsWith('http') ? url : `${API}${url}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'cl-pages-publish',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!res.ok && !okStatus.includes(res.status)) {
    const m = json?.message || text || res.statusText;
    if (res.status === 401) fail('GitHub rejected the token (401). Run `gh auth login` again.');
    if (res.status === 404 && url.includes(`/repos/${REPO}`)) fail(`cannot see ${REPO} (404). The token needs the repo scope and you need write access.`);
    throw Object.assign(new Error(`${method} ${url} -> ${res.status} ${m}`), { status: res.status, json });
  }
  return { status: res.status, json };
}

const repo = (p) => `/repos/${REPO}${p}`;

// Use the same Node executable and home as the publishing agent, never the browser's OS.
if (flags.update) {
  if (argv.length !== 1) fail('run --update by itself, then retry the original command.');
  let temporary;
  try {
    const revision = (await api('GET', repo('/commits/main'))).json.sha;
    if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('invalid installer revision');
    const source = (await api('GET', repo(`/contents/tools/install.mjs?ref=${revision}`))).json;
    temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cl-pages-update-'));
    const script = path.join(temporary, 'install.mjs');
    fs.writeFileSync(script, Buffer.from(source.content, 'base64'));
    const args = [script, '--ref', revision];
    const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
    const skillDir = path.dirname(scriptsDir);
    if (path.basename(scriptsDir) === 'scripts' && path.basename(skillDir) === 'publish-artifact') args.push('--skill-dir', skillDir);
    execFileSync(process.execPath, args, { stdio: 'inherit' });
  } catch (error) {
    console.error(`publish: update failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
  process.exit(process.exitCode || 0);
}

async function whoami() {
  const { json } = await api('GET', '/user');
  return json.login;
}

async function siteUrl() { return SITE_PRIMARY; }

async function head() {
  const ref = (await api('GET', repo(`/git/ref/heads/${BRANCH}`))).json;
  const commit = (await api('GET', repo(`/git/commits/${ref.object.sha}`))).json;
  const tree = (await api('GET', repo(`/git/trees/${commit.tree.sha}?recursive=1`))).json;
  if (tree.truncated) throw new Error('Repository tree listing was truncated; refusing incomplete reads or changes.');
  const files = new Map(tree.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e]));
  return { sha: ref.object.sha, treeSha: commit.tree.sha, files };
}

const jsonBlobs = new Map();
async function readBlobJson(entry) {
  if (!entry) return {};
  if (jsonBlobs.has(entry.sha)) return jsonBlobs.get(entry.sha);
  try {
    const { json } = await api('GET', repo(`/git/blobs/${entry.sha}`));
    const meta = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('expected a JSON object');
    jsonBlobs.set(entry.sha, meta);
    return meta;
  } catch (error) { throw new Error(`Cannot read metadata: ${error.message}`); }
}

// ---------------------------------------------------------------------------
// Paths and validation
// ---------------------------------------------------------------------------

const slugify = (s) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// Accepts users/<login>/<slug>, with or without slashes around it, or the artifact's URL on the site.
function artifactPath(p) {
  let s = String(p || '').trim();
  if (/^https?:\/\//i.test(s)) {
    const url = new URL(s);
    if (![new URL(SITE_PRIMARY).host, new URL(SITE_BACKUP).host].includes(url.host)) fail('artifact URL must use the Nova Pages primary or backup domain');
    s = url.pathname;
  }
  s = s.replace(/^\/+|\/+$/g, '');
  s = s.replace(/\/v\/[^/]+$/, '');
  const parts = s.split('/');
  if (parts.length !== 3 || parts[0] !== 'users' || parts.some((x) => !x || x === '.' || x === '..')) {
    fail(`"${p}" is not an artifact. Use users/<login>/<slug> or the artifact's URL.`);
  }
  return parts.join('/');
}

const teamSlug = (t) => {
  const s = slugify(String(t));
  if (!s) fail(`"${t}" is not a usable tag slug`);
  return s;
};

const versionId = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const parseVersionId = (id) => new Date(id.replace(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/, '$1-$2-$3T$4:$5:$6Z'));
// Version ids have one-second resolution. Two publishes in the same second (a race, or a quick
// republish) must not share a path, or the later one silently overwrites the earlier version.
function freeVersionId(files, dest) {
  let id = versionId();
  const taken = (x) => [...files.keys()].some((p) => p.startsWith(`${dest}/v/${x}/`));
  while (taken(id)) id = versionId(new Date(parseVersionId(id).getTime() + 1000));
  return id;
}

const gitBlobSha = (buf) => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

const TEXT_EXT = new Set(['.html', '.htm', '.md', '.txt', '.json', '.js', '.mjs', '.cjs', '.ts', '.css', '.csv', '.svg', '.xml', '.yml', '.yaml', '.sh', '.py', '.env', '.toml', '.ini']);
const SECRET_PATTERNS = [
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/github_pat_[A-Za-z0-9_]{60,}/, 'GitHub fine-grained token'],
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/sk-ant-[A-Za-z0-9_-]{40,}/, 'Anthropic API key'],
  [/\bsk-[A-Za-z0-9]{40,}/, 'API key (sk-…)'],
  [/xox[abpr]-[A-Za-z0-9-]{20,}/, 'Slack token'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JSON web token'],
  [/(?:password|passwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*["'](?![^"']*(?:example|your[-_ ]|xxx|<|\$\{))[^"'\s]{12,}["']/i, 'credential assignment'],
];

function scanSecrets(files) {
  const found = [];
  for (const f of files) {
    if (!TEXT_EXT.has(path.extname(f.rel).toLowerCase())) continue;
    const text = f.content.toString('utf8');
    for (const [re, label] of SECRET_PATTERNS) {
      const m = text.match(re);
      if (m) { found.push(`${f.rel}:${text.slice(0, m.index).split('\n').length}  ${label}`); break; }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Collect the files to publish
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', '__pycache__']);

function collect(src) {
  const st = fs.statSync(src);
  const out = [];
  if (st.isFile()) {
    const ext = path.extname(src).toLowerCase();
    const name = ['.html', '.htm'].includes(ext) ? 'index.html' : path.basename(src);
    out.push({ src, rel: name, content: fs.readFileSync(src) });
    return out;
  }
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
      const p = path.join(dir, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(p, r);
      else if (entry.isFile()) out.push({ src: p, rel: r, content: fs.readFileSync(p) });
    }
  };
  walk(src, '');
  return out;
}

const fmtBytes = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${Math.round(n / 1e3)} KB` : `${n} B`);

// ---------------------------------------------------------------------------
// Commit through the Git Data API, retrying when someone else pushed first
// ---------------------------------------------------------------------------

async function uploadBlobs(files, existing) {
  const known = new Set([...existing.values()].map((e) => e.sha));
  const todo = files.filter((f) => !known.has(f.sha));
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
      const f = todo[i++];
      const { json } = await api('POST', repo('/git/blobs'), { content: f.content.toString('base64'), encoding: 'base64' });
      if (json.sha !== f.sha) throw new Error(`blob sha mismatch for ${f.rel}`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker));
}

// entriesFor(head) returns the tree entries that take the current head to the desired state, or [] when nothing changes.
// It runs again on every attempt against a fresh head, so anything derived from the tree (like the version id) is recomputed.
async function commitWithRetry(message, entriesFor) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const h = await head();
    const entries = await entriesFor(h);
    if (!entries.length) return { sha: h.sha, unchanged: true, attempts: attempt };
    if (flags['dry-run']) return { sha: h.sha, dryRun: true, entries, attempts: attempt };
    const tree = (await api('POST', repo('/git/trees'), { base_tree: h.treeSha, tree: entries })).json;
    const msg = typeof message === 'function' ? message() : message;
    const commit = (await api('POST', repo('/git/commits'), { message: msg, tree: tree.sha, parents: [h.sha] })).json;
    const res = await api('PATCH', repo(`/git/refs/heads/${BRANCH}`), { sha: commit.sha }, { okStatus: [409, 422] });
    if (res.status < 300) return { sha: commit.sha, attempts: attempt };
    note(`someone else published at the same time; retrying (${attempt}/${RETRIES})`);
    await new Promise((r) => setTimeout(r, 400 * attempt + Math.random() * 400));
  }
  fail(`could not update ${BRANCH} after ${RETRIES} attempts. Try again.`);
}

// Compares this file with tools/publish.mjs on main. Copies below the site's minimum version are
// refused; other stale copies continue with an update notice. Installing is left to the calling agent.
async function selfCheck() {
  const selfPath = fileURLToPath(import.meta.url);
  let remoteSha, min = 0;
  try {
    remoteSha = (await api('GET', repo('/contents/tools/publish.mjs'))).json.sha;
    const v = await api('GET', repo('/contents/tools/publish-version.json'), null, { okStatus: [404] });
    if (v.status === 200) min = Number(JSON.parse(Buffer.from(v.json.content, 'base64').toString('utf8')).min) || 0;
  } catch { return; }
  if (VERSION < min) fail(`this copy of publish.mjs (v${VERSION}) is older than the site allows (v${min}). Update with:\n  ${INSTALL_CMD}`);
  if (remoteSha === gitBlobSha(fs.readFileSync(selfPath))) return;
  note(`note: a newer publish.mjs exists. Update with:\n  ${INSTALL_CMD}`);
}

const blobEntry = (p, content) => ({ path: p, mode: '100644', type: 'blob', content });
const shaEntry = (p, sha) => ({ path: p, mode: '100644', type: 'blob', sha });
const metaEntry = (dest, meta) => blobEntry(`${dest}/artifact.json`, JSON.stringify(meta, null, 2) + '\n');
const mergeTeams = (meta, add = [], remove = []) => {
  const set = new Set(artifactTags(meta));
  add.forEach((t) => set.add(t)); remove.forEach((t) => set.delete(t));
  const { teams, ...rest } = meta;
  return { ...rest, tags: [...set].sort() };
};
const sameTeams = (a, b) => JSON.stringify(artifactTags(a)) === JSON.stringify(artifactTags(b));
const versionIds = (files, dest) => [...new Set([...files.keys()].filter(p => p.startsWith(`${dest}/v/`)).map(p => p.split('/')[4]))].filter(id => VERSION_ID.test(id)).sort();
const latestVersionId = (files, dest) => versionIds(files, dest).at(-1) ?? null;
const purgeEntries = (files, dest, ids) => {
  const gone = new Set(ids);
  return [...files.keys()].filter(p => p.startsWith(`${dest}/v/`) && gone.has(p.split('/')[4])).map(p => shaEntry(p, null));
};

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function tagCatalog(h) {
  const definitions = [...h.files.keys()].filter(p => /^team\/[^/]+\/team\.json$/.test(p));
  const rows = new Map(await Promise.all(definitions.map(async p => {
    const slug = p.split('/')[1];
    const meta = await readBlobJson(h.files.get(p));
    return [slug, { slug, name: meta.name || slug, description: meta.description || '', count: 0 }];
  })));
  const artifacts = [...h.files.keys()].filter(p => /^users\/[^/]+\/[^/]+\/artifact\.json$/.test(p));
  let next = 0;
  const metadata = [];
  await Promise.all(Array.from({ length: Math.min(6, artifacts.length) }, async () => {
    while (next < artifacts.length) { const p = artifacts[next++]; metadata.push(await readBlobJson(h.files.get(p))); }
  }));
  for (const meta of metadata) {
    if (artifactExpired(meta)) continue;
    for (const slug of artifactTags(meta)) {
      if (!rows.has(slug)) rows.set(slug, { slug, name: slug, description: '', count: 0 });
      rows.get(slug).count++;
    }
  }
  return [...rows.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

async function listTeams() {
  const rows = await tagCatalog(await head());
  if (flags.json) return console.log(JSON.stringify(rows, null, 2));
  for (const r of rows) console.log(`${r.slug.padEnd(16)} ${r.name} · ${r.count} artifacts${r.description ? ` (${r.description})` : ''}`);
  console.log('\nUse pr for PR artifacts. A new slug creates a tag.');
}

async function publish(src) {
  if (!fs.existsSync(src)) fail(`${src} does not exist`);
  const abs = path.resolve(src);
  const isFile = fs.statSync(abs).isFile();
  const base = path.basename(abs);
  const teams = flags.tags.map(teamSlug);
  const login = await whoami();
  const prefs = readPreferences();
  let dest;
  if (flags.to) dest = artifactPath(flags.to);
  else {
    const slug = slugify(flags.slug || (isFile ? base.replace(/\.[^.]+$/, '') : base));
    if (!slug || slug === 'index' || slug === 'v') fail(`could not make a slug from "${base}"; pass --slug <name>`);
    dest = `users/${login}/${slug}`;
  }

  const owns = dest.split('/')[1].toLowerCase() === login.toLowerCase();
  if (flags.visibility && !owns) fail('Only the namespace owner can change artifact visibility.');

  const files = collect(abs);
  if (!files.length) fail(`${src} contains no files to publish`);
  for (const f of files) {
    f.sha = gitBlobSha(f.content);
    if (f.content.length > MAX_FILE) fail(`${path.relative(process.cwd(), f.src)} is ${fmtBytes(f.content.length)}; the limit per file is ${fmtBytes(MAX_FILE)}`);
  }
  const total = files.reduce((n, f) => n + f.content.length, 0);
  if (total > MAX_TOTAL) fail(`${fmtBytes(total)} in total; the limit per artifact is ${fmtBytes(MAX_TOTAL)}`);
  const hits = scanSecrets(files);
  if (hits.length && !flags['allow-secrets']) {
    fail(`this looks like it contains secrets. Remove them, or pass --allow-secrets if these are false alarms:\n  ${hits.join('\n  ')}`);
  }
  const index = files.find((f) => f.rel === 'index.html');
  if (index && !/<title>[^<]+<\/title>/i.test(index.content.toString('utf8').slice(0, 65536))) {
    note('note: index.html has no <title>; the site will list this artifact by its slug.');
  }

  const info = { purgedVersions: [], newArtifact: false, newTeams: [], sameAsLatest: false, version: null };
  const message = () => flags.message || `Publish ${dest} v/${info.version}\n\n${files.length} file${files.length === 1 ? '' : 's'}, ${fmtBytes(total)}, from ${base}. Published with tools/publish.mjs.`;
  const result = await commitWithRetry(message, async (h) => {
    const id = freeVersionId(h.files, dest);
    info.version = id;
    info.sameAsLatest = false;
    const existingMeta = await readBlobJson(h.files.get(`${dest}/artifact.json`));
    const latest = latestVersionId(h.files, dest);
    info.newArtifact = !latest;
    if (!latest && !owns) fail('New artifacts must be published in your own namespace.');
    // Resolve defaults only for new artifacts, against each retry's current tree.
    if (!latest) {
      const missing = [];
      if (!flags.lifetime && prefs.lifetime.ask) missing.push('lifetime');
      if (owns && !flags.visibility && prefs.visibility.ask) missing.push('visibility');
      if (missing.length) {
        const message = `Choose ${missing.join(' and ')} for this publish, then ask whether to remember each choice or ask again. Retry with ${missing.map(key => key === 'lifetime' ? '--lifetime <duration|unlimited>' : '--visibility unlisted|listed').join(' and ')}. Save preferences only when requested with --configure. Unlisted is the suggested visibility; direct links remain accessible to everyone with site access.`;
        if (flags.json) console.log(JSON.stringify({ action: 'input-required', missing, configPath, preferences: prefs, message }));
        fail(message);
      }
    }
    const knownTeams = new Set((teams.length ? await tagCatalog(h) : []).map(t => t.slug));
    info.newTeams = teams.filter((t) => !knownTeams.has(t));
    // Skip the new version when it is byte-identical to the latest one.
    if (latest) {
      const prefix = `${dest}/v/${latest}/`;
      const prev = new Map([...h.files.entries()].filter(([p]) => p.startsWith(prefix)).map(([p, e]) => [p.slice(prefix.length), e.sha]));
      info.sameAsLatest = prev.size === files.length && files.every((f) => prev.get(f.rel) === f.sha);
    }
    const entries = [];
    if (!info.sameAsLatest) {
      for (const f of files) entries.push(shaEntry(`${dest}/v/${id}/${f.rel}`, f.sha));
    }
    const meta = mergeTeams(existingMeta, teams);
    if (flags.retention) meta.retentionDays = parseRetention(flags.retention);
    else if (!latest) meta.retentionDays = 30;
    if (!latest || flags.lifetime) Object.assign(meta, lifetimeMetadata(flags.lifetime ? parseRetention(flags.lifetime) : prefs.lifetime.defaultDays));
    if (owns && (!latest || flags.visibility)) meta.visibility = flags.visibility || prefs.visibility.default;
    info.lifetimeDays = meta.lifetimeDays ?? null;
    info.expiresAt = meta.expiresAt ?? null;
    info.visibility = normalizeVisibility(meta.visibility || 'listed');
    if (!h.files.has(`${dest}/artifact.json`) || JSON.stringify(meta) !== JSON.stringify(existingMeta)) entries.push(metaEntry(dest, meta));
    const ids = [...versionIds(h.files, dest), ...(!info.sameAsLatest ? [id] : [])];
    info.retentionDays = retentionDays(meta);
    info.purgedVersions = expiredVersions(ids, info.retentionDays);
    entries.push(...purgeEntries(h.files, dest, info.purgedVersions));
    if (!info.sameAsLatest && !flags['dry-run']) await uploadBlobs(files, h.files);
    return entries;
  });
  await report({ action: 'publish', ...result, dest, files: files.length, bytes: total, teams, ...info });
}

async function tag(spec, remove) {
  const dest = artifactPath(spec.artifact);
  const teams = spec.teams.map(teamSlug);
  if (!teams.length) fail(`give at least one tag slug after ${remove ? '--untag' : '--tag'}`);
  const message = flags.message || `${remove ? 'Untag' : 'Tag'} ${dest}: ${teams.join(', ')}\n\nTagged with tools/publish.mjs.`;
  let after = [], newTeams = [];
  const result = await commitWithRetry(message, async (h) => {
    if (!latestVersionId(h.files, dest)) fail(`nothing is published at ${dest}`);
    const existing = await readBlobJson(h.files.get(`${dest}/artifact.json`));
    const meta = remove ? mergeTeams(existing, [], teams) : mergeTeams(existing, teams);
    after = meta.tags;
    const known = new Set((await tagCatalog(h)).map(t => t.slug));
    newTeams = remove ? [] : teams.filter(t => !known.has(t));
    return sameTeams(meta, existing) && h.files.has(`${dest}/artifact.json`) ? [] : [metaEntry(dest, meta)];
  });
  await report({ action: remove ? 'untag' : 'tag', ...result, dest, teams: after, newTeams });
}

async function setRetention(spec) {
  const dest = artifactPath(spec.artifact);
  const days = parseRetention(spec.duration);
  const result = await commitWithRetry(flags.message || `Set retention for ${dest}: ${spec.duration}`, async h => {
    if (!latestVersionId(h.files, dest)) fail(`nothing is published at ${dest}`);
    const meta = await readBlobJson(h.files.get(`${dest}/artifact.json`));
    if (meta.retentionDays === days) return [];
    // Changing the policy does not immediately purge: daily cleanup applies it.
    return [metaEntry(dest, { ...meta, retentionDays: days })];
  });
  await report({ action: 'set-retention', ...result, dest, retentionDays: days });
}

async function setPolicy(spec, field) {
  const dest = artifactPath(spec.artifact);
  if (field === 'visibility' && dest.split('/')[1].toLowerCase() !== (await whoami()).toLowerCase()) fail('Only the namespace owner can change artifact visibility.');
  const patch = field === 'visibility' ? { visibility: spec.duration } : lifetimeMetadata(parseRetention(spec.duration));
  const result = await commitWithRetry(flags.message || `Set ${field} for ${dest}: ${spec.duration}`, async h => {
    if (!latestVersionId(h.files, dest)) fail(`nothing is published at ${dest}`);
    const meta = await readBlobJson(h.files.get(`${dest}/artifact.json`));
    if (Object.entries(patch).every(([key, value]) => meta[key] === value)) return [];
    return [metaEntry(dest, { ...meta, ...patch })];
  });
  await report({ action: `set-${field}`, ...result, dest, ...patch });
}

async function purge(p) {
  const dest = p ? artifactPath(p) : null;
  let artifacts = [];
  const result = await commitWithRetry(flags.message || (dest ? `Purge old versions of ${dest}` : 'Purge expired artifact versions'), async h => {
    artifacts = [];
    const destinations = dest ? [dest] : [...new Set([...h.files.keys()].filter(p => /^users\/[^/]+\/[^/]+\/v\//.test(p)).map(p => p.split('/').slice(0, 3).join('/')))];
    const entries = [];
    for (const artifact of destinations) {
      const ids = versionIds(h.files, artifact);
      if (!ids.length) { if (dest) fail(`nothing is published at ${dest}`); else continue; }
      const meta = await readBlobJson(h.files.get(`${artifact}/artifact.json`));
      if (!dest && artifactExpired(meta)) {
        const changes = [...h.files.keys()].filter(p => p.startsWith(`${artifact}/`)).map(p => shaEntry(p, null));
        artifacts.push({ dest: artifact, expired: true, versions: ids, files: changes.length });
        entries.push(...changes);
        continue;
      }
      const days = flags['older-than'] ? parseRetention(flags['older-than']) : retentionDays(meta);
      const gone = flags.keep ? ids.slice(0, -Number(flags.keep)) : expiredVersions(ids, days);
      const changes = purgeEntries(h.files, artifact, gone);
      if (gone.length) artifacts.push({ dest: artifact, versions: gone, files: changes.length });
      entries.push(...changes);
    }
    return entries;
  });
  await report({ action: 'purge', ...result, dest, artifacts, files: artifacts.reduce((n, a) => n + a.files, 0), purged: artifacts.reduce((n, a) => n + a.versions.length, 0) });
}

async function remove(p) {
  const dest = artifactPath(p);
  const message = flags.message || `Remove ${dest}\n\nRemoved with tools/publish.mjs.`;
  let count = 0;
  const result = await commitWithRetry(message, async (h) => {
    const gone = [...h.files.keys()].filter((x) => x.startsWith(`${dest}/`));
    if (!gone.length) fail(`nothing is published at ${dest}`);
    count = gone.length;
    return gone.map((x) => shaEntry(x, null));
  });
  await report({ action: 'remove', ...result, dest, files: count });
}

async function waitForDeploy(sha) {
  const started = Date.now();
  note('waiting for the site to rebuild…');
  while (Date.now() - started < 8 * 60_000) {
    const { json } = await api('GET', repo(`/actions/runs?head_sha=${sha}&per_page=5`));
    const run = json.workflow_runs?.[0];
    if (run?.status === 'completed') return run.conclusion;
    await new Promise((r) => setTimeout(r, 6000));
  }
  return 'timeout';
}

async function report(r) {
  const site = await siteUrl();
  const url = !r.dest ? `${site}/` : r.action === 'remove' ? `${site}/${r.dest.split('/').slice(0, 2).join('/')}/` : `${site}/${r.dest}/`;
  const versionUrl = r.action === 'publish' && !r.sameAsLatest && !r.unchanged ? `${url}v/${r.version}/` : undefined;
  let deploy = null;
  if (flags.wait && !r.unchanged && !r.dryRun) deploy = await waitForDeploy(r.sha);
  if (flags.json) return console.log(JSON.stringify({ ...r, ...(r.teams ? { tags: r.teams } : {}), url, versionUrl, deploy, entries: undefined }, null, 2));

  const short = (r.sha || '').slice(0, 7);
  if (r.dryRun) {
    console.error(`dry run: would ${r.action} ${r.dest || 'expired history across the site'} (${r.entries.length} tree change${r.entries.length === 1 ? '' : 's'})`);
    for (const e of r.entries) console.error(`  ${e.sha === null ? '-' : '+'} ${e.path}`);
    console.error(`url: ${url}`);
    return;
  }
  if (r.unchanged) {
    console.error(r.action === 'publish' ? 'nothing changed: these files are identical to the latest version and no metadata or history changed.' : 'nothing changed.');
  } else {
    if (r.action === 'publish') {
      console.error(r.sameAsLatest
        ? `files identical to the latest version, so no new version was added; metadata or expired history updated in commit ${short}.`
        : `${r.newArtifact ? 'created' : 'published a new version of'} ${r.dest} (${r.files} file${r.files === 1 ? '' : 's'}, ${fmtBytes(r.bytes)}) in commit ${short}.`);
      if (r.teams.length) console.error(`tags: ${r.teams.join(', ')}`);
      for (const t of r.newTeams) console.error(`created tag "${t}". Give it a display name with team/${t}/team.json {"name": "…"}.`);
      if (r.purgedVersions.length) console.error(`Purged ${r.purgedVersions.length} older versions under the retention policy (maximum 10 versions). Git history remains.`);
      console.error(`Visibility: ${r.visibility}. Lifetime: ${r.expiresAt ? `expires ${r.expiresAt}` : 'unlimited'}. Everyone with site access can open the link.`);
    } else if (r.action === 'tag' || r.action === 'untag') {
      console.error(`${r.dest} now has tags: ${r.teams.length ? r.teams.join(', ') : 'none'} (commit ${short}). Visibility unchanged.`);
      for (const t of r.newTeams) console.error(`created tag "${t}". Give it a display name with team/${t}/team.json {"name": "…"}.`);
    } else if (r.action === 'set-visibility' || r.action === 'set-lifetime') {
      console.error(r.action === 'set-visibility' ? `Visibility: ${r.visibility}. Direct links remain accessible to everyone with site access.` : `Lifetime: ${r.expiresAt ? `expires ${r.expiresAt}` : 'unlimited'}.`);
    } else if (r.action === 'set-retention') {
      console.error(`History retention: ${r.retentionDays === null ? 'unlimited age' : `${r.retentionDays} days`}; maximum 10 versions. The latest is kept until the artifact lifetime expires. Applied by the next publish or daily cleanup.`);
    } else if (r.action === 'purge') {
      console.error(`Purged ${r.purged} versions (${r.files} files). Expired artifacts removed in full; other latest pages and metadata kept. Git history remains.`);
    } else {
      console.error(`removed ${r.files} file${r.files === 1 ? '' : 's'} in commit ${short}. Git history keeps them.`);
    }
    console.error(deploy ? `site rebuild ${deploy}.` : 'the site rebuilds in about a minute.');
  }
  console.log(url);
}

// ---------------------------------------------------------------------------

try {
  await selfCheck();
  if (flags.whoami) console.log(await whoami());
  else if (flags.listTags || flags.teams) await listTeams();
  else if (flags['set-lifetime']) await setPolicy(flags['set-lifetime'], 'lifetime');
  else if (flags['set-visibility']) await setPolicy(flags['set-visibility'], 'visibility');
  else if (flags['set-retention']) await setRetention(flags['set-retention']);
  else if (flags.purge || flags['purge-expired']) await purge(flags.purge);
  else if (flags.tag) await tag(flags.tag, false);
  else if (flags.untag) await tag(flags.untag, true);
  else if (flags.remove) await remove(flags.remove);
  else if (positional.length === 1) await publish(positional[0]);
  else { usage(); process.exit(positional.length ? 1 : 0); }
} catch (e) {
  fail(e.message);
}
