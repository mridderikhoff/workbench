# Packet: performance

Applies to Angular folders in supported Angular/TypeScript projects and reads
every file in the review scope ([`../schema.md`](../schema.md) → "Review scope"), including
stores, services, and plain `.ts` helpers. Apply the relevant data and lifetime probes
to other TypeScript libraries and browser test projects.

Check the target's change-detection configuration. The target may use Zone.js or zoneless change detection, and
published components may run in external apps. A template method repeats its
work whenever change detection checks its view. Review zone-dependent behaviour where the
target uses it. Follow repo profile → `conventions` for utility imports.

Judge a cost by how often it runs times what it touches. Hot paths are per-row, per-cell and
per-record callbacks; pointer, scroll and input events; observer callbacks; and work repeated per
keystroke. Work in a hot path that depends only on slower-changing state is done when that state
changes, not on every call.

This is a static, read-only review. A cost the code shows outright is a finding; an impact only
a measurement could confirm (bundle size, frame time during scroll or reposition, layout thrash,
request volume under real data) is a **verify** row that names the observation and what each
outcome becomes. Route measurements through the available host capability. This packet
does a static read only. Without a measurement the report states
`Performance verdict: static only`. A probe tagged `(class: …)` names a defect category
to put in the Finding cell so a static row and a measured finding line up. These tags
describe the cost: `rerender`, `query-fanout`, `stream-stall`, `duplicate-request`,
`broad-collection-read`, and `navigation-feedback`. The Class cell uses the five classes in
the review schema.

Where no repository rule covers a finding, cite the packet's section heading.

## 1. Data work

**Question:** does work over data stay proportional to the data?

The Finding cell names the input that grows and the cost in terms of it ("O(n²) in siblings per
level", "one full scan of `rows` per row"). A super-linear cost is acceptable where a comment
at the site records why the input stays small; cite that comment in the `no findings` evidence.

- `perf-1.1` **Accumulator and deep copies.** Building, flattening, grouping, or filtering a
  collection stays linear. Copying the accumulator on every pass is a finding: `[...acc, x]`
  or `{ ...acc, [key]: x }` inside `reduce`, `concat` in a loop, or recursion that returns a
  fresh array per call and spreads it into its parent's. Building a flat tree-node list that
  copies the whole array once per sibling is quadratic in level size. So is `structuredClone`
  or `JSON.parse(JSON.stringify(…))` inside a loop, a `computed`, or a per-item callback,
  unless the site names the mutation the copy isolates. Appending each loaded page with
  `[...rows, ...page]` is quadratic across pages, and copying an input array (`[...input()]`)
  only to satisfy a type or a library's mutability costs O(rows) per update; both are findings.
- `perf-1.2` **Lookups inside a loop.** A `find`, `filter`, `some`, `includes`, or `indexOf`
  over the same collection inside a loop or a `map` callback is a finding where a `Map` or
  `Set` built once before the loop would answer the same question.
- `perf-1.3` **Repeated sorts and scans.** A sort, a full scan, or a derived collection rebuilt
  once per item, rather than once per pass, is a finding. For a sort over a large collection,
  inspect comparator work repeated O(n log n) times, including locale setup or repeated
  normalization; verify impact when the API's internal cost is uncertain.
- `perf-1.4` **Rework on unrelated change.** A `computed`, `linkedSignal`, or store method that
  rebuilds a derived structure reads only the inputs that structure depends on. One that also
  reads an unrelated signal, or rebuilds the whole structure when one field of one item changes
  while a narrower `computed` would isolate it, is a finding (class: `rerender`).
  A chart whose documented architecture uses one pure resolver for the render model
  recomputes that model on any input change by design.
  Splitting it into several `computed`s is not a `fix`; report it only as **verify** with a
  measured cost, and never recommend fragmenting the render model.
- `perf-1.5` **Work in render positions.** A template that calls a method doing collection work
  in an interpolation, property binding, or control-flow condition repeats that work on every
  render of the view, and once per row inside `@for` (class: `rerender`). See
  repo profile → `angular` → signal state. The fix decorates
  items inside the list's `computed` so the template binds a field.
- `perf-1.6` **Expensive objects built once.** A parser, sanitizer, formatter, or pattern (`new
  Marked`, `createDOMPurify(window)`, an `Intl.*Format`, a `RegExp`) constructed inside a render
  function, a `computed`, or a per-item callback is a finding where one instance held by the
  class, the service, or the module would serve every call.
- `perf-1.7` **Chart options.** An ag-charts options `computed` reads only the data and theme
  it renders, so it rebuilds, and the chart reconfigures, only when one of them changes; one
  that also reads an unrelated input is a finding. A tooltip renderer or formatter that reads
  no reactive value is created once outside it; one that must read current data or theme stays
  derived inside it (class: `rerender`).
- `perf-1.8` **Library per-item callbacks.** A callback a library calls once per row, cell, or
  node (AG Grid `doesFilterPass`, `valueGetter`, `comparator`, `cellRenderer` refresh; ag-charts
  formatters) is a render position. Work that depends only on filter, column, or chart state is
  computed when that state changes and read inside the callback (class: `rerender`).

## 2. Reactivity

**Question:** does a change re-render only what it affects?

- `perf-2.1` Use `OnPush`, signal inputs, and a `computed` where it can replace an `effect()`.
  See `craft-2.4` and `craft-2.2` for Angular conventions. Report the re-render cost here
  (class: `rerender`).
- `perf-2.2` **`@for` tracking.** Every `@for` declares a `track`. Stateful or interactive
  rows track a stable identity; `track $index` over those rows when they can move or be
  inserted between is a finding (class: `rerender`). A regenerated, stateless, text-only row
  list may track position to reuse DOM across reordering when row-local state, focus, and
  identity semantics do not depend on node retention; verify the rendered data and
  accessibility behavior.
- `perf-2.3` **Effect cascades.** An `effect()` that writes a signal which feeds further
  `computed`s or effects schedules another render for a value a `computed` or `linkedSignal`
  would derive in one (repo profile → `angular` →
  dependent signal state). An effect writing a signal it also reads is a
  finding whatever the cascade (class: `rerender`).
- `perf-2.4` **Unbounded lists.** A list that grows with user or server data is bounded by pagination
  or virtualization (CDK virtual scrolling). `@defer` delays the first render of an off-screen
  section but bounds nothing. A `@for` over such a collection with neither bound is a
  finding. When the supported data volume is unknown, use **verify** (class:
  `large-table-work`): observe the maximum rendered rows and interaction cost; a supported
  bounded volume is no finding.
- `perf-2.5` **Per-keystroke work.** A search or filter input that drives filtering over a
  large collection, or a request, is debounced. Work each keystroke repeats is limited to what
  the new query changes: normalising every option again (lowercasing each label per keystroke)
  is a finding where the normalised form could be derived once with the options (class:
  `rerender`, or `duplicate-request` when each keystroke sends a request).
- `perf-2.6` **Synchronous storage.** A `localStorage` or `sessionStorage` write inside an
  `effect()` or a per-keystroke handler, without a debounce, blocks the main thread on every
  change; it is a finding.
- `perf-2.7` **Counter signals.** A signal bumped as a counter or version number to wake an
  effect or `computed` (`tick.update((tick) => tick + 1)`, `version.set(version() + 1)`) re-runs
  its dependants on every notification, including ones that change nothing the computation
  reads. Store the observed value instead, so signal equality skips no-op writes
  (repo profile → `angular` → signal state). Class: `rerender`.
  The fix is neutral when the dependants read the value they were re-measuring anyway.
  A counter that re-runs a controlled-state sync after a declined user change is an exception.
- `perf-2.8` **High-frequency events.** Pointer, hover, scroll, and input handlers, and the
  `computed`s they feed, touch only the items the event changes. A hover that re-maps every
  mark, or an input event that re-reads the whole document, is a finding where binding the state
  by id or updating the changed item would do (class: `rerender`).

## 3. Lifecycle and memory

**Question:** is every long-lived hook, stream, and allocation justified, shared where it can
be, and released?

- `perf-3.1` **Per-instance hooks.** Per-instance subscriptions and monitors (CDK
  `FocusMonitor`, `ResizeObserver`, `MutationObserver`, `IntersectionObserver`) need a
  documented rationale or a brief implementation comment at the site. A doc comment states
  the caller contract (repo profile → `comments` → doc comments).
  Dispose each hook via `DestroyRef`. The RxJS teardown form is `angular` →
  `craft-2.9`. The merge step keeps one row when both report the same line.
- `perf-3.2` **N instances, N hooks.** Rendering N instances must not create N overlays, N
  listeners on `document` or `window`, N observers where one shared observer could watch every
  target, or N id generators beyond CDK's own.
- `perf-3.3` **Global listeners and timers.** Every `document` or `window` listener added by
  hand, and every `setInterval`, `setTimeout`, and `requestAnimationFrame`, is cleared on
  destroy through `DestroyRef.onDestroy` or an `effect`'s `onCleanup`. An interval started by a
  root store or service has explicit teardown too. Template and `host: {}` listeners are torn
  down by Angular and pass.
- `perf-3.4` **Layout thrash in callbacks.** An observer or scroll callback that reads layout
  (`getBoundingClientRect`, `offsetWidth`, `scrollHeight`) and then writes a style or size the
  observer watches loops or forces synchronous layout; a `ResizeObserver` that resizes its own
  target is the source of `ResizeObserver loop` errors.
- `perf-3.5` **Streams.** A server-sent-event or `fetch` stream reader aborts when its consumer
  is destroyed. Streamed token updates are batched per frame or per interval rather than
  re-parsing markdown or replacing an `[innerHTML]` on every chunk (class: `stream-stall`).
- `perf-3.6` **Object URLs and data URLs.** Every `URL.createObjectURL` has a matching
  `URL.revokeObjectURL` when the URL is no longer shown. A base64 data URL held in a signal or a
  store keeps the whole encoded payload in memory and in every derived copy; it is a finding
  where an object URL or a fetched resource would do.
- `perf-3.7` **DOM sweeps.** A `MutationObserver` or animation-frame callback that re-queries a
  whole rendered subtree, when the mutation records or a per-item library hook would deliver the
  change, is a finding. Name the subtree size.

## 4. Rendering and CSS

**Question:** does a frame cost only what it must?

- `perf-4.1` **Transitions.** Only `transform` and `opacity` animate on the compositor alone.
  A transition on color, background, border-color, or box-shadow repaints each frame and passes
  when the painted area is small (a control, not a full panel). A transition on
  `width`/`height`/layout is a finding, and so is `will-change` declared permanently, on many
  elements, or on a property no animation changes. When the painted area cannot be established
  statically, use **verify**: observe the transition in its largest state; a small painted area
  is no finding; a treatment that would change the specified motion stays **verify** against the
  spec's motion, never a swap by default.
- `perf-4.2` **Layout reads in loops.** Reading a layout property inside a loop that also
  writes styles forces a layout per iteration. Batch the reads before the writes. Inserting and
  removing a measurement element per item counts as a write: insert every probe, read every
  size, then remove them all.

## 5. Loading and network

**Question:** does the target load and fetch only what it uses?

Use the target's existing data-loading owner. For Angular resource selection, see
repo profile → `angular` → HTTP and resources.

- `perf-5.1` **Lazy boundaries.** A feature route loads through `loadComponent` or
  `loadChildren` (repo profile → `angular` → lazy loading). A heavy component off the first view (a chart, an editor, a
  dialog body) sits behind `@defer`. An eager import that pulls a lazily routed feature into
  the initial bundle is a finding.
- `perf-5.2` **Import weight.** `import * as` from a large library, an import of a library's
  all-in-one entry point where a scoped entry point exists, or a barrel import that carries a
  module with side effects is a finding. Whether it changes the shipped bundle is **verify**:
  observe the emitted chunk; no material contribution is no finding. A plainly unused import
  is **fix**.
- `perf-5.3` **Shared data, fetched once.** Data more than one instance reads is fetched once
  and held where those instances share it: a store or `providedIn: 'root'` service, not an
  `httpResource` or HTTP call per instance. Two requests for the same resource in one view are
  a finding (class: `duplicate-request`).
- `perf-5.4` **Per-item fan-out.** `Promise.all`, `forkJoin`, or `mergeMap` over a list that
  issues one request per item, or an HTTP call inside a `@for` child, is a finding where one
  batched request would serve the list (class: `query-fanout`).
- `perf-5.5` **Broad reads.** A read that pages an entire growing collection (an `expand()`
  continuation-token loop with no stopping bound) or fetches a whole collection to use one item
  is a finding (class: `broad-collection-read`).
- `perf-5.6` **Store caches.** A shared store that caches responses declares its cache key, a
  freshness window, de-duplication of an in-flight request, and a size bound. A cache missing
  one of them is a finding naming which (class: `duplicate-request`).
- `perf-5.7` **Stale responses.** When the selection or query changes, the response for the
  previous one is cancelled or ignored — `switchMap`, a request sequence number, or an
  `AbortController` — so a late response cannot overwrite the current view.
- `perf-5.8` **Polling.** A poll states its rate, bounds its retries or total time, pauses
  while the tab is hidden, and stops at a terminal state and when its consumer is destroyed. A
  poll missing one of them, or whose rate has no recorded reason, is a finding (class:
  `polling-rate`).
- `perf-5.9` **Navigation feedback.** A route guard or resolver does not hold navigation on a
  broad read, and a lazy route shows loading feedback while it loads. A static read settles
  only part of this; what it cannot settle is a **verify** row naming the navigation to observe
  (class: `navigation-feedback`). Immediate feedback is no finding. Use the documented
  loading treatment or the one a sibling route uses.
- `perf-5.10` **Main-thread parsing.** Parsing an input whose size the user controls (Markdown,
  CSV, DOCX, large JSON) runs synchronously only under a stated size cap. Above the cap it runs
  in a Web Worker or progressively. The largest allowed input is a **verify** row.

## 6. Canvas and WebGL

**Question:** does a rendered scene release what it allocates and stop when nobody sees it?

- `perf-6.1` **Disposal.** Every three.js or WebGL geometry, material, texture, and renderer
  the component creates is `dispose()`d on destroy, along with its animation-frame loop and
  resize listener.
- `perf-6.2` **Frame budget.** The renderer caps the device pixel ratio, and the animation loop
  pauses on `visibilitychange` and while the canvas is off-screen.
- `perf-6.3` **Scene loading.** A heavy scene, and the library that draws it, loads behind
  `@defer` rather than in the initial bundle of the view that hosts it.

## 7. Other material concern

- `perf-7.1` Use independent judgment to identify a material cost, lifetime, rendering, or
  loading concern this packet's named probes miss. Name the growing input or resource and its
  cost; `schema.md` → "Wildcard rule". For a large
  subtree switched by `@if` or another mode condition, trace whether returning to that mode
  recreates the subtree and repeats preparation or layout; verify toggle cost at representative
  data volume.

## Classification

A rewrite is **fix** only
when static review shows behaviour, rendered output, iteration order, and the public API
unchanged: replacing a spread accumulator with `push`, hoisting a `Map` or formatter built
once, moving a template method into a `computed`. A cost whose size only a measurement can
establish is **verify**, naming the observation and the outcome each result produces.
