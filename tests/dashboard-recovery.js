#!/usr/bin/env node
// Behavioural checks for the Overseer page's startup and recovery states.
// Runs the page's real app script (INITIAL ... poll) from bin/qa-dashboard in a Node vm against small DOM stubs,
// so the real render(), poll() and click handlers execute. No browser, jsdom or network is involved.
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), assert = require("assert");
const SRC = fs.readFileSync(path.join(__dirname, "..", "bin", "qa-dashboard"), "utf8");

function between(start, end) {
  const a = SRC.indexOf(start), b = SRC.indexOf(end, a);
  assert(a >= 0 && b > a, "source markers moved: " + start);
  return SRC.slice(a, b);
}
const APP = between("var INITIAL=/*INITIAL*/null/*END*/;", "// Procedural brushstrokes");
const FAVICON = between("favicon: function (state) {", "copy: function");

class El {
  constructor(id) {
    this.id = id || ""; this.innerHTML = ""; this.textContent = ""; this.className = ""; this.hidden = false; this.disabled = false;
    this.dataset = {}; this.style = {}; this.children = []; this.attrs = {}; this.handlers = {}; this.isConnected = true; this.open = false;
    this.classList = {
      add: c => { const s = new Set(this.className.split(/\s+/).filter(Boolean)); s.add(c); this.className = [...s].join(" ") },
      remove: c => { this.className = this.className.split(/\s+/).filter(x => x && x !== c).join(" ") },
      contains: c => this.className.split(/\s+/).includes(c),
      toggle: (c, on) => on ? this.classList.add(c) : this.classList.remove(c),
    };
  }
  setAttribute(k, v) { this.attrs[k] = String(v) }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null }
  hasAttribute(k) { return k in this.attrs }
  addEventListener(type, fn) { (this.handlers[type] = this.handlers[type] || []).push(fn) }
  fire(type, extra) { (this.handlers[type] || []).forEach(fn => fn(Object.assign({ target: this, currentTarget: this, preventDefault() {} }, extra))) }
  querySelector() { return new El() }
  querySelectorAll() { return [] }
  appendChild(c) { this.children.push(c); return c }
  insertBefore(c, ref) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); const j = ref ? this.children.indexOf(ref) : -1; this.children.splice(j < 0 ? this.children.length : j, 0, c); c.parent = this; return c }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this) }
  contains(c) { return c === this || this.children.includes(c) }
  closest() { return null }
  focus() {}
  getBoundingClientRect() { return { left: 0, right: 0, top: 0, bottom: 0 } }
  showModal() { this.open = true }
  close() { this.open = false }
}

// A fresh page: stubs for the browser, the app script run for real, and a recorded fetch.
function page(opts) {
  opts = opts || {};
  const els = {}, calls = [], timers = [];
  const get = id => els[id] || (els[id] = new El(id));
  const doc = new El("document");
  Object.assign(doc, {
    body: new El("body"), documentElement: new El("html"), activeElement: null, hidden: false, visibilityState: "visible",
    getElementById: get, hasFocus: () => true, createElement: () => new El(), dispatchEvent() {},
    querySelector: sel => sel === "main" ? get("main") : new El(),
  });
  const favicons = [];
  const sandbox = {
    document: doc, console, Promise, JSON, Date, Math, Object, Array, String, Number, Set, Error, CustomEvent: function () {},
    localStorage: { getItem: () => null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
    location: { search: "" }, QA_PERF: null,
    setInterval: () => 0, clearInterval() {}, clearTimeout() {},
    setTimeout: (fn, ms) => { timers.push(ms); return timers.length },
    // The page's theme object is a separate script; the stub records favicon states and keeps nothing healthy by default.
    QA_THEME: { glyph: t => "[" + t + "]", icon: () => "", copy: (k, f) => f, id: () => "t", isDark: () => false, sceneId: () => "desk", current: () => ({}), buttonHover: () => "none", favicon: s => favicons.push(s) },
    fetch: (url, init) => { calls.push({ url, init }); return opts.fetch(url, init) },
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = () => ({ matches: true });
  sandbox.window.addEventListener = () => {};
  sandbox.hasFocus = () => true;
  vm.createContext(sandbox);
  // The page defines helpers on later lines of other scripts; these two are the only ones the app script needs from outside it.
  vm.runInContext("function stub(){}; var QA_BRUSH=undefined;", sandbox);
  vm.runInContext(APP.replace("if(!INITIAL)poll();", ""), sandbox);
  return {
    sandbox, els, calls, timers, favicons, get,
    run: code => vm.runInContext(code, sandbox),
    poll: () => vm.runInContext("poll()", sandbox),
    text: id => els[id] && els[id].textContent,
    html: id => els[id] && els[id].innerHTML,
  };
}

const jsonResponse = (body, ok = true, status = 200) => Promise.resolve({ ok, status, json: () => Promise.resolve(body) });
const badJson = (status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.reject(new SyntaxError("Unexpected token <")) });
const snapshot = slots => ({ generatedAt: "2026-01-01T00:00:00Z", backend: { overall: "ready", relation: "develop", sha: "abc", services: { api: { probe: "ready", status: "ready" } } }, slots, actions: null });
const saved = (slot, fp) => ({ slot, branch: "b" + slot, apps: [{ app: "ri" }], worktree: "/w/b" + slot, recovery: { fingerprint: fp, resumable: true } });
const plain = v => JSON.parse(JSON.stringify(v)); // values from the vm realm compare by structure
const cards = p => p.get("slots").children.map(c => c.innerHTML).join("|");

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test("before the first status: placeholders, count not 0, no empty/down claim, busy", () => {
  const p = page({ fetch: () => new Promise(() => {}) });
  assert(/Loading saved sessions…/.test(cards(p)), cards(p));
  assert(/Checking backend status…/.test(p.html("backend")));
  assert.strictEqual(p.text("sessions-count"), "");
  assert.strictEqual(p.get("main").getAttribute("aria-busy"), "true");
  assert.doesNotMatch(cards(p) + p.html("backend"), /No sessions running|No backend data|Backend is down/);
  assert.strictEqual(p.sandbox.document.title, "Overseer · loading…");
  assert.strictEqual(p.run("pageHealth()"), "unknown");
  assert.strictEqual(p.run("window.QA_ROLLUP"), "unknown");
  assert.strictEqual(p.favicons[p.favicons.length - 1], "unknown");
  const radio = p.run("radioMessages(data,failure,actionError)");
  assert.deepStrictEqual(plain(radio.map(m => m.key)), ["loading"]);
  assert(/Loading saved sessions….*Checking backend status…/.test(radio[0].text));
  assert.deepStrictEqual(p.calls.map(c => c.url), [], "nothing is fetched until poll runs");
});

test("initial failure: status unavailable and retrying, not empty or down; later success shows sessions", async () => {
  let n = 0;
  const p = page({ fetch: () => ++n === 1 ? jsonResponse({ error: "boom" }, false, 502) : jsonResponse(snapshot([saved(1, "f1")])) });
  await p.poll();
  assert(/Status unavailable, retrying/.test(cards(p)) && /Status unavailable, retrying/.test(p.html("backend")));
  assert.doesNotMatch(cards(p) + p.html("backend"), /No sessions running|No backend data|Checking backend|down/i);
  assert.strictEqual(p.get("main").getAttribute("aria-busy"), "false");
  assert.strictEqual(p.text("sessions-count"), "");
  assert.match(p.text("banner"), /^Status unavailable - retrying: boom$/);
  assert.strictEqual(p.sandbox.document.title, "(!) Overseer · status unavailable");
  assert.strictEqual(p.run("pageHealth()"), "unknown");
  assert.strictEqual(p.favicons[p.favicons.length - 1], "unknown");
  assert.strictEqual(p.run("window.QA_ROLLUP"), "unknown");
  const radio = p.run("radioMessages(data,failure,actionError)");
  assert.deepStrictEqual(plain(radio.map(m => [m.key, m.tone])), [["failure", "unknown"]]);
  assert(p.timers.length >= 1, "a retry is scheduled");
  await p.poll();
  assert.strictEqual(p.run("failure"), null);
  assert.strictEqual(p.text("sessions-count"), "1");
  assert(/b1/.test(cards(p)) && !/Status unavailable/.test(cards(p)));
  assert.strictEqual(p.html("recovery-rows").includes('data-slot="1"'), true);
});

test("a valid snapshot with slots[] empty shows the true empty card", async () => {
  const p = page({ fetch: () => jsonResponse(snapshot([])) });
  await p.poll();
  assert.match(cards(p), /No sessions running/);
  assert.strictEqual(p.text("sessions-count"), "0");
  assert.strictEqual(p.run("pageHealth()"), "ok");
});

test("a later failed poll keeps the last snapshot, its cards, its backend and a stale banner", async () => {
  const replies = [() => jsonResponse(snapshot([saved(1, "f1")])), () => jsonResponse({ error: "late" }, false, 502), () => badJson(502)];
  const p = page({ fetch: () => replies.shift()() });
  await p.poll();
  const before = [cards(p), p.html("backend"), p.run("pageHealth()")];
  await p.poll();
  assert.deepStrictEqual([cards(p), p.html("backend"), p.run("pageHealth()")], before);
  assert.strictEqual(p.text("banner"), "Status unavailable - showing stale data: late");
  assert.strictEqual(p.run("window.QA_ROLLUP"), "ok");
  assert.doesNotMatch(p.html("backend"), /unavailable|No backend data/);
  assert.match(p.sandbox.document.title, /^\(!\) Overseer · 1 session$/);
  assert(p.run("radioMessages(data,failure,actionError)").some(m => /Showing the last data/.test(m.text)));
  await p.poll(); // a 502 whose body is not JSON is still a plain HTTP failure
  assert.strictEqual(p.text("banner"), "Status unavailable - showing stale data: HTTP 502");
  assert.strictEqual(p.run("data.slots.length"), 1);
});

test("malformed or wrongly shaped responses never replace data or become a fake empty state", async () => {
  const bodies = [snapshot([saved(1, "f1")]), {}, { slots: [], backend: null }, { slots: {}, backend: {} }, [], null, "text", { backend: {}, slots: "x" }];
  const p = page({ fetch: () => jsonResponse(bodies.shift()) });
  await p.poll();
  const good = p.run("data");
  for (let i = 1; i < 8; i++) {
    await p.poll();
    assert.strictEqual(p.run("data"), good, "body " + i + " must not replace data");
    assert.match(p.text("banner"), /Unreadable status response/);
    assert.doesNotMatch(cards(p), /No sessions running/);
  }
  assert.match(cards(p), /b1/);
  const q = page({ fetch: () => badJson() });
  await q.poll();
  assert.strictEqual(q.run("data"), null);
  assert.doesNotMatch(cards(q), /No sessions running/);
  assert.match(cards(q), /Status unavailable, retrying/);
});

test("Resume and Start fresh act directly with their payloads; a second click is blocked; no automatic POST", async () => {
  const posts = [];
  const p = page({ fetch: (url, init) => { if (init && init.method === "POST") { posts.push({ url, body: JSON.parse(init.body), headers: init.headers }); return new Promise(() => {}) } return jsonResponse(snapshot([saved(2, "f2"), saved(1, "f1"), Object.assign(saved(3, "f3"), { recovery: { fingerprint: "f3", resumable: false, reason: "x" } })])) } });
  await p.poll();
  assert.deepStrictEqual(posts, [], "nothing is posted by loading");
  assert.strictEqual(p.get("recovery-fresh").disabled, false);

  p.get("recovery-resume").fire("click");
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].url, "/api/recovery/resume");
  assert.deepStrictEqual(posts[0].body, { slots: [{ slot: 1, fingerprint: "f1" }, { slot: 2, fingerprint: "f2" }] });
  assert.strictEqual(posts[0].headers["X-QA-Dashboard"], "1");
  p.get("recovery-resume").fire("click");
  p.get("recovery-fresh").fire("click");
  assert.strictEqual(posts.length, 1, "optimistic running state blocks a second action");
  assert.strictEqual(p.get("recovery-fresh").disabled, true);

  const q = page({ fetch: (url, init) => { if (init && init.method === "POST") { posts.push({ url, body: JSON.parse(init.body) }); return new Promise(() => {}) } return jsonResponse(snapshot([saved(2, "f2"), saved(1, "f1"), Object.assign(saved(3, "f3"), { recovery: { fingerprint: "f3", resumable: false, reason: "x" } })])) } });
  await q.poll();
  posts.length = 0;
  q.get("recovery-fresh").fire("click");
  q.get("recovery-fresh").fire("click");
  q.get("recovery-resume").fire("click");
  assert.strictEqual(posts.length, 1, "double click sends one request");
  assert.strictEqual(posts[0].url, "/api/recovery/forget");
  assert.deepStrictEqual(posts[0].body, { slots: [{ slot: 1, fingerprint: "f1" }, { slot: 2, fingerprint: "f2" }, { slot: 3, fingerprint: "f3" }] });
  assert.strictEqual(q.run("typeof freshDialog + typeof samePairs"), "undefinedundefined");
  assert.strictEqual(q.run("recoveryBox.hidden"), false);
  assert.strictEqual(q.run("isRunning()"), true);
});

test("no saved sessions and no data: Start fresh does nothing", async () => {
  const posts = [];
  const p = page({ fetch: (url, init) => { if (init && init.method === "POST") posts.push(url); return new Promise(() => {}) } });
  p.get("recovery-fresh").fire("click");
  p.get("recovery-resume").fire("click");
  assert.deepStrictEqual(posts, []);
});

test("favicon: unknown is a blank icon, known states keep theme art", () => {
  const icon = { href: "x", dataset: {} };
  const ctx = { document: { querySelector: () => icon }, encodeURIComponent, active: { theme: { favicon: "<svg-theme/>", favicons: { ok: "<svg-ok/>" } } } };
  vm.createContext(ctx);
  const fn = vm.runInContext("(function(){return {" + FAVICON.replace(/[,\s]*$/, "") + "}})().favicon", ctx);
  fn("unknown"); assert.strictEqual(icon.href, "data:,");
  fn("ok"); assert.strictEqual(icon.href, "data:image/svg+xml," + encodeURIComponent("<svg-ok/>"));
  fn("warn"); assert.strictEqual(icon.href, "data:image/svg+xml," + encodeURIComponent("<svg-theme/>"));
  fn("unknown"); assert.strictEqual(icon.href, "data:,");
});

test("the fresh-confirm dialog and its styling are gone; Stop confirmation stays", () => {
  assert.doesNotMatch(SRC, /fresh-confirm|fresh-cancel|freshDialog|samePairs/);
  assert.match(SRC, /id="stop-confirm"/);
  assert.match(SRC, /function confirmStop\(/);
  assert.doesNotMatch(SRC, /\.loading #backend/);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log("ok   " + name) } catch (e) { failed++; console.log("FAIL " + name + "\n  " + (e && e.stack || e).split("\n").slice(0, 4).join("\n  ")) }
  }
  console.log(failed ? failed + " of " + tests.length + " failed" : "all " + tests.length + " passed");
  process.exit(failed ? 1 : 0);
})();
