# Packet: correctness

Apply this packet to Angular and TypeScript targets listed in the repo profile, including
their consumed code ([`../schema.md`](../schema.md) → "Review scope"). Apply a probe
where its behavior occurs, including relevant tests.

A probe applies wherever the behaviour it covers occurs, whatever the folder: local form
validation and option values apply to a form component that loads no data and holds no store
state, and component-local state counts for § 3. A reviewer answers `not applicable — <why>`
only when the target has no instance of the probe's behaviour. § 6 covers every component
that declares inputs, a `model()`, or outputs another component binds.

This is a static, read-only review of whether the code produces the right result. A finding
names the concrete input or sequence that produces the wrong one ("an empty `documents`
response renders 'No documents' after a 500", "deleting the selected row leaves `selectedId`
pointing at nothing") and states the correct result. A suspicion with no such input is not a
finding. Security, accessibility, and test quality are outside this packet; `angular` § 6
judges tests, and a repo contract packet judges public component contracts.

Each probe states its rule in plain terms and names its source where one exists. Cite the
packet's section heading when the probe itself is the rule. Where a probe overlaps another
packet's, correctness reports the wrong runtime result.

## 1. Inputs and edge cases

**Question:** does every input the code can receive produce a correct result?

- `correct-1.1` **Edge inputs.** An empty collection, a single item, the last page, a value at a
  boundary (zero, the maximum, the first or last index), and duplicate entries each produce a
  correct result. A `reduce` without an initial value over a list that can be empty, an
  off-by-one at a page or range edge, or a list keyed by a field that can repeat is a finding.
- `correct-1.2` **Absent values read as present.** `Object.entries`, `Object.keys`, or
  `Object.values` on a value that can be `null` or `undefined`, a field the API can omit read as
  always there, and unchecked index access (`items[0]`, `byId[key]`) used as defined are each a
  finding where the type or the response allows the absent case.
- `correct-1.3` **Null handling.** `null` is normalized to `undefined` where it enters,
  nullish checks match the declared type, and no non-null assertion (`!`) hides an absent
  value. Undefined-only unions use strict undefined checks. Unions admitting both use
  nullish checks. Follow repo profile → `angular` → absence handling when it states a
  different convention. A contract that deliberately declares a nullable form value,
  such as `model<Date | null>(null)`,
  can seed that value.
- `correct-1.4` **Optional chaining that hides missing data.** `a?.b?.c` in a template or a
  `computed` that renders a blank cell, an empty label, or `0` where the data is missing, rather
  than an error or an empty state, is a finding. Which state replaces the blank follows
  `correct-2.1`.
- `correct-1.5` **Unknown keys and exhaustiveness.** One bad row must not take down a whole
  `computed` or list. A lookup in a status-to-presentation map with no fallback for an unknown
  key, and a `switch` over a union with neither a `default` nor a `never` exhaustiveness check,
  are each a finding. When a union's values can arrive from an external source, derive the
  type from the shared values and pair it with a runtime guard and a fallback.

## 2. Async and failure

**Question:** does every failure reach the user as a failure, and does every pending state end?

- `correct-2.1` **Failure is not empty.** A `.catch`, a `catchError`, or an error branch that
  turns a failure into a valid-looking empty list or not-found state is a finding; error, empty,
  and not-found stay distinct. Treating any error as not-found is a finding.
  repo profile → `angular` →
  loading states keeps the error case separate.
- `correct-2.2` **Rejections and error copy.** Every `firstValueFrom` and promise has its
  rejection handled. An HTTP error reaches the user as a finished sentence, never raw
  `err.message`, an HTTP status, `TypeError` text, or a stack trace
  from the underlying error. Follow repo profile → `i18n` →
  user-visible strings for user-facing copy. An unhandled rejection or raw error
  text shown is **mandated** when an existing
  user-facing message contract supplies the one replacement; otherwise the wording is
  **default**, reusing the nearest sibling surface's message, and **decide** when no sibling
  surface supplies the wording. A backend 4xx detail is passed through only when the API
  contract marks it user-facing; otherwise that replacement wording stands in for it.
- `correct-2.3` **Pending states end.** A loading or pending flag resets on failure as well as
  on success, so no spinner or disabled state sticks, and restoring after loading does not undo a
  disabled state set for another reason. Loading gates mutation and preserves focus.
  See repo profile → `angular` →
  loading states. An `httpResource` or `resource` read checks `hasValue()` before
  `value()` (repo profile → `angular` → HTTP and resources).
- `correct-2.4` **Double submit.** A mutation cannot be fired again while its request is
  pending; a save button or submit handler with no in-flight guard is a finding.
- `correct-2.5` **Success feedback after settle.** A toast, banner, or navigation that reports
  success fires only after the write succeeds. Feedback driven by a route or query parameter, or
  by an effect that runs on arrival, re-fires on back navigation or refresh and is a finding.
- `correct-2.6` **Conflicts.** A concurrent-edit conflict (HTTP 409) is surfaced as a conflict
  the user can resolve, not as a generic failure.
- `correct-2.7` **Ordering and teardown.** A write to a signal or store after the component is
  destroyed or the user has navigated away, and a request issued before the id it depends on is
  set (bootstrap ordering), are each a finding. A late response
  overwriting the current view is `performance` → `perf-5.7`.

## 3. State consistency

**Question:** does every copy of a fact agree with every other, after every change?

- `correct-3.1` **Optimistic updates roll back.** A store or component that applies a change
  before the server confirms it restores the previous value when the request fails.
- `correct-3.2` **One source of truth.** Derived state is a `computed`, not a stored copy that
  can drift from its source, and two components or stores each holding their own "selected" item
  for the same fact is a finding (repo profile → `angular` → signal state). The copy nearer its source survives.
- `correct-3.3` **Selection stays valid.** A selection survives delete, filter, and refresh only
  while it still points at a present item; otherwise it is cleared or moved. A blur or close
  handler must not reset state that the click following it depends on. A stale selection is
  cleared unless a spec or a sibling surface moves it.
- `correct-3.4` **Refresh keeps loaded data.** A refresh does not clear loaded data before the
  new data arrives, which would flash an empty state. Keep stale data visible during a
  reload. The ordering half is `performance` → `perf-5.7`.
- `correct-3.5` **Parameter-keyed state.** State keyed to a route or context parameter resets or reloads when
  that parameter changes; keeping data for the previous context is a finding. Require a
  context-change guard only when the application can change that context during a session.
- `correct-3.6` **Refetch on every server change.** Every event that changes server state the
  view shows (an async completion, an upload, a stream end, or a mutation elsewhere on the page) triggers a refetch or a local update. A view left stale after one of them is a finding.
- `correct-3.7` **Counts reflect outcomes.** A count or summary ("N passed", "all clear",
  "3 drafted") filters on the real outcome, not on the presence of a record; counting rows that
  exist regardless of their status is a finding.
- `correct-3.8` **Uniqueness excludes the edited entity.** A validator that checks uniqueness
  compares against the current values excluding the entity being edited, matched by id, so its
  own unchanged or just-saved name never flags itself as a duplicate. The server's 409 stays the
  backstop.
- `correct-3.9` **`linkedSignal` reset.** A `linkedSignal` resets when its source changes and
  keeps local edits otherwise; one whose source is too broad discards edits, and one whose source
  is too narrow keeps a value for the previous entity
  (repo profile → `angular` → dependent signal state). An in-place mutation of an object or array held in a signal,
  which notifies nothing, is a finding under this probe
  (repo profile → `angular` → signal state).

## 4. Values and units

**Question:** does every number, date, and string mean the same thing where it is produced and
where it is shown?

- `correct-4.1` **Units.** A formatter that assumes a scale (millions, a 0–1 or a 0–100
  percentage) is called only with that scale, and the assumed unit is in its name or its type.
  A caller passing the other scale is a finding.
- `correct-4.2` **Rounding and money.** `toFixed`, `Math.round`, and number formats round to the
  precision the field's contract sets — its unit, its type, its spec, or the precision the same
  value shows elsewhere — never to an assumed one. Rounding 0.269 to `0`, or $0.50 to $1, where
  that contract shows finer precision is a finding. Money arithmetic does not accumulate
  floating-point error into a displayed total. A field with no contract keeps the precision the
  same value shows elsewhere, or its source's.
- `correct-4.3` **Date-only values.** A date-only string (`YYYY-MM-DD`) passed to `new Date()`
  parses as UTC midnight. It is a finding only when the result is then formatted, compared, or
  computed in local time, so the calendar day shifts in time zones west of UTC; formatting it in
  UTC (`timeZone: 'UTC'`, `getUTC*`) is correct. One folder uses one date-normalizing helper
  consistently.
- `correct-4.4` **Date input round trip.** A date input accepts the formats its control
  displays, and a field that displays a value never reports "required".
- `correct-4.5` **Renderer syntax.** Text passed through a math or markdown renderer escapes the
  characters that renderer treats as syntax, such as `$` in a currency amount.
- `correct-4.6` **Sorting.** A string sort uses `localeCompare`. A value compares as a number
  only where the field's contract says it is numeric, so `"10"` does not sort before `"9"`; an
  identifier that merely looks numeric, such as a zero-padded code, sorts as a string. A `sort`
  with no comparator over numbers is a finding.

## 5. Forms, routes, and API contract

**Question:** do the UI's types and rules agree with what the API and router actually do?

- `correct-5.1` **Validation matches the API.** UI validation enforces the API's constraints
  (required fields, lengths, ranges, formats), so a form the UI accepts is not rejected by the
  server. Required and optional fields follow the API declaration. For Data-Driven Forms,
  see repo profile → `component-library` → form validation.
- `correct-5.2` **Honest response types.** A response type does not declare non-null a field the
  API may return as `null` or omit, and an unchecked `as` cast on a response or a parsed value is
  a finding where a type guard with a fallback would hold the claim.
- `correct-5.3` **Option values are keys.** A select or option control's value keys into its
  options, so the label always reflects the current options. Treat the options as the
  source of truth for the label and use the value as the key into them.
- `correct-5.4` **Navigation commands.** `router.navigate` places `..` only in `commands[0]`.
  Use the enclosing application's route-building helper when its routing contract provides
  one. See repo profile → `angular` →
  navigation.
- `correct-5.5` **Encoded ids, once.** An entity id interpolated into a raw URL string or path
  segment goes through `encodeURIComponent`. A value passed through Angular router
  `queryParams`, a router commands array, or `HttpParams` is already encoded; encoding it again
  double-encodes it and is the finding.

## 6. Component behaviour

**Question:** does the component behave correctly across every input change, user action, and
dismissal?

Use the control's documented binding and form-state contract. Build interaction on native
HTML and existing repository controls where they cover the behaviour. See
repo profile → `component-library` → its component selection guidance,
repo profile → `angular` → components and signal state, and
repo profile → `angular` →
model inputs and view and content queries.

- `correct-6.1` **Value changes emit on user action.** A value-change output or `model()` whose
  spec or doc comment requires a user action emits only on that action. Emitting on init, on a
  programmatic write of the same value, or on an event sourced from data or a grid is a finding;
  re-activating the current value (picking the selected option again) behaves as the spec says.
  Open and close state (`open = model(false)`), dismissal outputs (`closed`), and any
  output whose contract includes programmatic changes may emit on those changes. Use the
  component's documented contract and
  repo profile → `angular` →
  model inputs.
- `correct-6.2` **No input snapshots.** No field initializer or constructor copies an input's
  value; that copy never sees a later change. State derived from an input is a `computed`, or a
  `linkedSignal` when it also takes local edits (overlaps `correct-3.2` and `correct-3.9`;
  repo profile → `angular` → dependent signal state).
- `correct-6.3` **Derived UI follows its sources.** Overlay contents, filter choices, the empty
  or no-match state, and parts driven by `contentChildren` recompute when their input or the
  projected content changes. See
  repo profile → `angular` → view and content queries applies.
- `correct-6.4` **Shown text matches the value.** The text a control shows and its committed
  `model` value agree after every commit, cancel, close, and invalid parse (overlaps
  `correct-4.4`).
- `correct-6.5` **Disabled and loading gate every mutation path.** `disabled` and `loading` gate
  click, the clear affix, `Delete` and `Backspace`, and every keyboard path that changes the
  value, and loading never sets native `disabled` on a text-entry control. Loading gates
  mutation and preserves focus. Actual disabled state uses the native mechanism where available.
- `correct-6.6` **Pending work cancelled.** A pending animation frame, timer, or callback is
  cancelled on dismiss, on an input change that supersedes it, and on destroy (overlaps
  `correct-2.7`;
  repo profile → `angular` → effect cleanup).
  Check synchronous output handlers that reopen or replace the surface before deferred work
  runs; obsolete callbacks must not move focus or mutate the new state.
- `correct-6.7` **Active item stays valid.** The active index and the
  `aria-activedescendant` target reset when the options change or the popup closes, so they
  never name a removed or hidden item. The active item and the element with DOM focus are
  distinct when using `aria-activedescendant` (published component semantics are handed to the repo contract packet when present).
- `correct-6.8` **Portaled surfaces count as inside.** Dismiss logic — `pointerleave` and
  outside-click handlers — treats a portaled surface (a tooltip, an overlay) as inside the
  component that opened it. When the surface closes, emit the dismissal event described
  by its public contract.

## 7. Other material concern

- `correct-7.1` Use independent judgment to identify a material wrong result this packet's
  named probes miss. Name the failing input or sequence and the correct result;
  `schema.md` → "Wildcard rule".

## Classification

Every row states the correct result. **mandated** when an existing type, spec, doc comment, or cited rule
determines it (the spinner stops on failure, the calendar day does not shift, a 500 is not
rendered as "No documents", an unknown key falls back), with the Finding naming the failing
input and the Action naming a regression test that drives it. The refine writer adds the test. The orchestrator runs the scoped gates specified by
[`SKILL.md`](../../SKILL.md).
