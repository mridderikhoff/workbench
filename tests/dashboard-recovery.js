#!/usr/bin/env node
// Behavioural checks for the Overseer page's startup and recovery states, the first-run tenant prompt and the backend switch.
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
    localStorage: { getItem: k => k === "qaDashboardTenant" && opts.tenant || null, setItem() {} }, sessionStorage: { getItem: () => null, setItem() {} },
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
const snapshot = slots => ({ generatedAt: "2026-01-01T00:00:00Z", backend: { overall: "healthy", relation: "develop", sha: "abc", services: { api: { probe: "ready", status: "ready" } } }, slots, actions: null });
const fp = n => "c0ffee00000000" + n.toString(16).padStart(2, "0"); // 16 hex characters, like the server's
const saved = slot => ({ slot, branch: "b" + slot, apps: [{ app: "ri" }], worktree: "/w/b" + slot, recovery: { fingerprint: fp(slot), resumable: true } });
const plain = v => JSON.parse(JSON.stringify(v)); // values from the vm realm compare by structure
const recoverySnapshot = () => snapshot([saved(3), saved(2), Object.assign(saved(4), { recovery: { fingerprint: fp(4), resumable: false, reason: "x" } })]);
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
  const p = page({ fetch: () => ++n === 1 ? jsonResponse({ error: "boom" }, false, 502) : jsonResponse(snapshot([saved(2)])) });
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
  assert.strictEqual(p.text("sessions-count"), "0");
  assert.strictEqual(cards(p), "", "a saved slot is not also a session card");
  assert.strictEqual(p.get("sessions-title").hidden, true);
  assert.strictEqual(p.get("slots").hidden, true);
  assert.strictEqual(p.get("hint").hidden, true);
  assert.strictEqual(p.html("recovery-rows").includes('data-slot="2"'), true);
});

test("a valid snapshot with slots[] empty shows the true empty card", async () => {
  const p = page({ fetch: () => jsonResponse(snapshot([])) });
  await p.poll();
  assert.match(cards(p), /No sessions running/);
  assert.strictEqual(p.text("sessions-count"), "0");
  assert.strictEqual(p.run("pageHealth()"), "ok");
});

test("saved slots appear only in the recovery picker; live slots keep their cards and count", async () => {
  const live = { slot: 5, branch: "live5", apps: [{ app: "ri" }], worktree: "/w/live5" };
  const bodies = [snapshot([saved(2), saved(3)]), snapshot([saved(2), live]), snapshot([live]), snapshot([saved(2)]), snapshot([])];
  const p = page({ fetch: () => jsonResponse(bodies.shift()) });
  const title = () => p.sandbox.document.title;

  await p.poll(); // saved only: no Sessions section, no empty-state card
  assert.strictEqual(p.get("recovery").hidden, false);
  assert.strictEqual(p.html("recovery-rows").includes('data-slot="2"') && p.html("recovery-rows").includes('data-slot="3"'), true);
  assert.strictEqual(cards(p), "");
  assert.doesNotMatch(cards(p), /No sessions running/);
  assert.deepStrictEqual([p.get("sessions-title").hidden, p.get("slots").hidden, p.get("hint").hidden], [true, true, true]);
  assert.strictEqual(p.text("sessions-count"), "0");
  assert.strictEqual(title(), "Overseer · 0 sessions");

  await p.poll(); // mixed: only the live slot is a card and is counted
  assert.strictEqual(p.get("recovery").hidden, false);
  assert.strictEqual(p.html("recovery-rows").includes('data-slot="2"'), true);
  assert.strictEqual(p.get("slots").children.length, 1);
  assert(/live5/.test(cards(p)) && !/b2/.test(cards(p)));
  assert.deepStrictEqual([p.get("sessions-title").hidden, p.get("slots").hidden, p.get("hint").hidden], [false, false, false]);
  assert.match(p.html("hint"), /To start another session/);
  assert.strictEqual(p.text("sessions-count"), "1");
  assert.strictEqual(title(), "Overseer · 1 session");

  await p.poll(); // recovery flags cleared, live remains: normal UI, picker gone
  assert.strictEqual(p.get("recovery").hidden, true);
  assert(/live5/.test(cards(p)));
  assert.deepStrictEqual([p.get("sessions-title").hidden, p.get("slots").hidden, p.get("hint").hidden], [false, false, false]);
  assert.strictEqual(p.text("sessions-count"), "1");

  await p.poll(); // back to saved only
  assert.strictEqual(p.get("recovery").hidden, false);
  assert.strictEqual(cards(p), "");
  assert.deepStrictEqual([p.get("sessions-title").hidden, p.get("slots").hidden, p.get("hint").hidden], [true, true, true]);

  await p.poll(); // saved slot resumed or forgotten and gone: the true empty state
  assert.strictEqual(p.get("recovery").hidden, true);
  assert.match(cards(p), /No sessions running/);
  assert.deepStrictEqual([p.get("sessions-title").hidden, p.get("slots").hidden], [false, false]);
  assert.strictEqual(p.text("sessions-count"), "0");
});

test("saved slots return to session cards once their recovery flags clear", async () => {
  const cleared = slot => Object.assign({}, slot, { recovery: undefined });
  const bodies = [snapshot([saved(2)]), snapshot([cleared(saved(2))])];
  const p = page({ fetch: () => jsonResponse(bodies.shift()) });
  await p.poll();
  assert.strictEqual(cards(p), "");
  await p.poll();
  assert.strictEqual(p.get("recovery").hidden, true);
  assert(/b2/.test(cards(p)), "a slot without recovery is a normal card");
  assert.strictEqual(p.get("sessions-title").hidden, false);
  assert.strictEqual(p.text("sessions-count"), "1");
});

test("a later failed poll keeps the last snapshot, its cards, its backend and a stale banner", async () => {
  const replies = [() => jsonResponse(snapshot([saved(2)])), () => jsonResponse({ error: "late" }, false, 502), () => badJson(502)];
  const p = page({ fetch: () => replies.shift()() });
  await p.poll();
  const before = [cards(p), p.html("backend"), p.run("pageHealth()")];
  await p.poll();
  assert.deepStrictEqual([cards(p), p.html("backend"), p.run("pageHealth()")], before);
  assert.strictEqual(p.text("banner"), "Status unavailable - showing stale data: late");
  assert.strictEqual(p.run("window.QA_ROLLUP"), "ok");
  assert.doesNotMatch(p.html("backend"), /unavailable|No backend data/);
  assert.match(p.sandbox.document.title, /^\(!\) Overseer · 0 sessions$/);
  assert(p.run("radioMessages(data,failure,actionError)").some(m => /Showing the last data/.test(m.text)));
  await p.poll(); // a 502 whose body is not JSON is still a plain HTTP failure
  assert.strictEqual(p.text("banner"), "Status unavailable - showing stale data: HTTP 502");
  assert.strictEqual(p.run("data.slots.length"), 1);
});

// Each body is JSON-valid and has the top-level keys, but would make render() throw or claim an empty state.
const withSlots = slots => Object.assign(snapshot([]), { slots });
const MALFORMED = {
  "empty object": {}, "null backend": { slots: [], backend: null }, "slots not an array": { slots: {}, backend: {} }, "array": [], "null": null, "string": "text",
  "slots is a string": { backend: {}, slots: "x" },
  "null slot": withSlots([null]), "string slot": withSlots(["x"]), "array slot": withSlots([[]]),
  "apps not an array": withSlots([Object.assign(saved(2), { apps: "ri" })]), "apps is an object": withSlots([Object.assign(saved(2), { apps: { app: "ri" } })]),
  "null app": withSlots([Object.assign(saved(2), { apps: [null] })]), "string app": withSlots([Object.assign(saved(2), { apps: ["ri"] })]),
  "numeric app url": withSlots([Object.assign(saved(2), { apps: [{ app: "ri", url: 5 }] })]),
  "services not an object": Object.assign(snapshot([]), { backend: { overall: "healthy", services: [] } }),
  "null service": Object.assign(snapshot([]), { backend: { overall: "healthy", services: { api: null } } }),
  "string service": Object.assign(snapshot([]), { backend: { overall: "healthy", services: { api: "ready" } } }),
  "actions not an object": Object.assign(snapshot([]), { actions: "running" }),
  "action output not an array": Object.assign(snapshot([]), { actions: { action: "heal", state: "ok", output: "line one" } }),
};

test("malformed or wrongly shaped responses never replace data, keep the stale UI and keep retrying", async () => {
  for (const [name, bad] of Object.entries(MALFORMED)) {
    const bodies = [snapshot([saved(2)]), bad];
    const p = page({ fetch: () => jsonResponse(bodies.shift()) });
    await p.poll();
    const good = p.run("data"), before = [cards(p), p.html("backend")], timers = p.timers.length;
    await p.poll(); // a render() that throws would reject here
    assert.strictEqual(p.run("data"), good, name + " must not replace data");
    assert.deepStrictEqual([cards(p), p.html("backend")], before, name + " must keep the stale UI");
    assert.match(p.text("banner"), /^Status unavailable - showing stale data: /, name);
    assert.doesNotMatch(cards(p), /No sessions running/, name);
    assert.strictEqual(p.timers.length, timers + 1, name + " must schedule the next poll");
  }
});

test("a malformed first response stays unavailable and retrying, never a fake empty state", async () => {
  for (const [name, bad] of Object.entries(MALFORMED)) {
    const p = page({ fetch: () => jsonResponse(bad) });
    await p.poll();
    assert.strictEqual(p.run("data"), null, name);
    assert.match(cards(p), /Status unavailable, retrying/, name);
    assert.doesNotMatch(cards(p) + p.html("backend"), /No sessions running|No backend data/, name);
    assert.strictEqual(p.text("sessions-count"), "", name);
    assert.strictEqual(p.run("pageHealth()"), "unknown", name);
    assert.strictEqual(p.timers.length, 1, name + " must schedule a retry");
  }
  const q = page({ fetch: () => badJson() });
  await q.poll();
  assert.strictEqual(q.run("data"), null);
  assert.match(cards(q), /Status unavailable, retrying/);
});

test("sparse or unknown but well-formed snapshots are accepted and render", async () => {
  const sparse = {
    backend: { overall: "healthy", services: null, future: { x: 1 } },
    slots: [{ slot: 2, branch: "b2", apps: null, mystery: [1] }, { slot: 3, branch: "b3", apps: [{ app: "ri", url: null, httpReady: true }, { app: "ds-demo", url: "http://x/", extra: 1 }] }, { slot: 4 }],
    actions: { action: "heal", state: "ok", output: [] },
  };
  const p = page({ fetch: () => jsonResponse(sparse) });
  await p.poll();
  assert.strictEqual(p.run("failure"), null);
  assert.strictEqual(p.text("sessions-count"), "3");
});

test("a real but unknown snapshot keeps the page health neutral, not healthy", async () => {
  const unknown = { backend: { overall: "unknown", services: {} }, slots: [] };
  const noneKnown = { backend: { overall: "unknown", services: { api: { status: "mystery" } } }, slots: [] };
  for (const body of [unknown, noneKnown]) {
    const p = page({ fetch: () => jsonResponse(body) });
    await p.poll();
    assert.strictEqual(p.run("failure"), null);
    assert.strictEqual(p.run("pageHealth()"), "unknown");
    assert.strictEqual(p.favicons[p.favicons.length - 1], "unknown");
    assert.strictEqual(p.run("window.QA_ROLLUP"), "unknown");
    assert.match(p.html("backend"), /tone-unknown/);
  }
  // With no services listed, the overall label still decides: healthy, degraded and down keep their meaning.
  for (const [overall, rollup, health] of [["healthy", "ok", "ok"], ["degraded", "warn", "warn"], ["down", "down", "down"]]) {
    const p = page({ fetch: () => jsonResponse({ backend: { overall, services: {} }, slots: [] }) });
    await p.poll();
    assert.strictEqual(p.run("window.QA_ROLLUP"), rollup, overall);
    assert.strictEqual(p.run("pageHealth()"), health, overall);
    assert.match(p.html("backend"), new RegExp("tone-" + rollup), overall);
  }
  const healthy = page({ fetch: () => jsonResponse(snapshot([])) });
  await healthy.poll();
  assert.strictEqual(healthy.run("pageHealth()"), "ok");
});

test("rebuilding ready apps keep a healthy favicon while build failures and startup still warn", async () => {
  for (const [app, health, pill] of [
    [{ httpReady: true, build: { state: "building" } }, "ok", /rebuilding/],
    [{ httpReady: true, build: { state: "failed" } }, "bad", /build failed/],
    [{ httpReady: false, unitState: "active", build: { state: "building" } }, "warn", /starting/],
  ]) {
    const p = page({ fetch: () => jsonResponse(snapshot([{ slot: 2, branch: "build", apps: [{ app: "ri", ...app }] }])) });
    await p.poll();
    assert.strictEqual(p.run("pageHealth()"), health);
    assert.strictEqual(p.favicons[p.favicons.length - 1], health);
    assert.match(cards(p), pill);
  }
});

test("Resume and Start fresh act directly with their payloads; a second click is blocked; no automatic POST", async () => {
  const posts = [];
  const p = page({ fetch: (url, init) => { if (init && init.method === "POST") { posts.push({ url, body: JSON.parse(init.body), headers: init.headers }); return new Promise(() => {}) } return jsonResponse(recoverySnapshot()) } });
  await p.poll();
  assert.deepStrictEqual(posts, [], "nothing is posted by loading");
  assert.strictEqual(p.get("recovery-fresh").disabled, false);

  p.get("recovery-resume").fire("click");
  assert.strictEqual(posts.length, 1);
  assert.strictEqual(posts[0].url, "/api/recovery/resume");
  assert.deepStrictEqual(posts[0].body, { slots: [{ slot: 2, fingerprint: fp(2) }, { slot: 3, fingerprint: fp(3) }] });
  assert.strictEqual(posts[0].headers["X-QA-Dashboard"], "1");
  p.get("recovery-resume").fire("click");
  p.get("recovery-fresh").fire("click");
  assert.strictEqual(posts.length, 1, "optimistic running state blocks a second action");
  assert.strictEqual(p.get("recovery-fresh").disabled, true);

  const q = page({ fetch: (url, init) => { if (init && init.method === "POST") { posts.push({ url, body: JSON.parse(init.body) }); return new Promise(() => {}) } return jsonResponse(recoverySnapshot()) } });
  await q.poll();
  posts.length = 0;
  q.get("recovery-fresh").fire("click");
  q.get("recovery-fresh").fire("click");
  q.get("recovery-resume").fire("click");
  assert.strictEqual(posts.length, 1, "double click sends one request");
  assert.strictEqual(posts[0].url, "/api/recovery/forget");
  assert.deepStrictEqual(posts[0].body, { slots: [{ slot: 2, fingerprint: fp(2) }, { slot: 3, fingerprint: fp(3) }, { slot: 4, fingerprint: fp(4) }] });
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

test("service restart disables actions immediately, then restores state if the request fails", async () => {
  let resolve;
  const p = page({ fetch: () => new Promise(done => { resolve = done }) });
  p.run('data=' + JSON.stringify(snapshot([])));
  p.run('data.backend.relation="behind 1"');
  p.run('runAction("restart",null,"api")');
  assert.strictEqual(p.run("isRunning()"), true);
  assert.strictEqual(p.run("data.actions.action"), "restart");
  assert.strictEqual(p.run("data.actions.target"), "api");
  assert.match(p.html("backend"), /data-action="update"[^>]*disabled/);
  assert.strictEqual(p.calls[0].url, "/api/backend/restart");
  assert.deepStrictEqual(JSON.parse(p.calls[0].init.body), { service: "api" });
  resolve({ ok: false, json: () => Promise.resolve({ error: "unavailable" }) });
  await new Promise(done => setImmediate(done));
  assert.strictEqual(p.run("isRunning()"), false);
  assert.strictEqual(p.run("data.actions"), null);
  assert.match(p.html("backend"), /unavailable/);
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

test("first visit asks for the tenant; a saved tenant skips the prompt and fills Settings", () => {
  const first = page({ fetch: () => new Promise(() => {}) });
  assert.strictEqual(first.get("tenant-welcome").open, true);
  assert.strictEqual(first.get("tenant").value, "", "no personal default tenant");
  const known = page({ tenant: "jsmith", fetch: () => new Promise(() => {}) });
  assert.strictEqual(known.get("tenant-welcome").open, false);
  assert.strictEqual(known.get("tenant").value, "jsmith");
});

test("each session offers to switch the backend to its branch, except the one already on it", async () => {
  const snap = snapshot([{ slot: 2, branch: "feat/a", apps: [{ app: "ri" }], head: { sha: "aaa111" } },
                         { slot: 3, branch: "feat/b", apps: [{ app: "ri" }], head: { sha: "bbb222" } },
                         { slot: 4, branch: "feat/c", apps: [{ app: "ri" }], head: { sha: "ccc999" } }]);
  Object.assign(snap.backend, { branch: "feat/b", sha: "bbb222" });
  const p = page({ fetch: url => url === "/api/status" ? jsonResponse(snap) : jsonResponse({ actions: { action: "attach", target: "feat/a", state: "running", output: [] } }, true, 202) });
  await p.poll();
  const html = p.get("slots").children.map(c => c.innerHTML);
  const card = b => html.find(h => h.includes(">" + b + "<"));
  assert.match(card("feat/a"), /data-attach="feat\/a"[^>]*>Use for backend</);
  assert.match(card("feat/b"), /Backend runs this branch/);
  assert.doesNotMatch(card("feat/b"), /data-attach/);
  assert.strictEqual(p.run("attachAvailable('feat/b')"), false);
  snap.backend.branch = "feat/c"; snap.backend.sha = "ccc111";
  await p.poll();
  assert.match(p.get("slots").children.map(c => c.innerHTML).join("|"), /Backend runs an older commit.*>Update backend</);
  assert.strictEqual(p.run("attachAvailable('feat/c')"), true);
  p.run("runAction('attach','feat/a')");
  await new Promise(r => setImmediate(r));
  const post = p.calls.find(c => c.url === "/api/slot/backend");
  assert(post, "the switch posts to /api/slot/backend");
  assert.deepStrictEqual(JSON.parse(post.init.body), { branch: "feat/a" });
  assert.match(p.get("slots").children.map(c => c.innerHTML).join("|"), /Switching the backend/);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try { await fn(); console.log("ok   " + name) } catch (e) { failed++; console.log("FAIL " + name + "\n  " + (e && e.stack || e).split("\n").slice(0, 4).join("\n  ")) }
  }
  console.log(failed ? failed + " of " + tests.length + " failed" : "all " + tests.length + " passed");
  process.exit(failed ? 1 : 0);
})();
