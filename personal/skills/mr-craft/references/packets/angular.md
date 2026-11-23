# Packet: Angular craft

Apply this packet to Angular and TypeScript targets listed in the repo profile, including
their consumed code. Apply testing probes to the target's tests when relevant.

Follow [`../schema.md`](../schema.md) → "Review scope" and its report schema. Judge consumed
files by the target's use and read each cited rule. Use repo profile → `conventions` →
imports, class prefixes, and package manager; use `angular` → interop and stores.

## 1. Names

**Question:** does every name say what the value means to the reader, rather than where it
came from or how it was produced?

- `craft-1.1` **Meaning, not mechanism.** Inventory folder, feature, module, component,
  type, member, input/output, property, local, constant, and helper names in the target and
  consumed owners. With declarations hidden, each name must reveal its purpose at the tree or
  call site; `pushedSize` names plumbing. A caption input names its text role (`actionLabel`),
  not an implied action (`action`); cite binding and rendered use. A doc comment cannot rescue
  ambiguity. In multi-step code, name compound conditions or intermediate values when that
  clarifies intent without changing evaluation order or signal dependencies; do not name every
  expression.
- `craft-1.2` **Effective-value pattern.** A fallback chain over an input, a context value,
  and a default is one `computed` named after the role: the context value takes a private
  name (`#formFieldSize`), the chain the role name prefixed `effective` (`effectiveSize`),
  and neither is named after its source.
- `craft-1.4` **Comment-to-name conversion.** A comment explaining what a value holds, or
  why this value was chosen, moves into the name or the type when it fits, and is deleted.
- `craft-1.5` **One word per concept.** The same concept uses the same word across the
  folder and across the components this one composes. State words carry their ARIA meaning:
  `active` only for the `aria-activedescendant` target, never for selected, current, pressed,
  open, applied, or highlighted.
- `craft-1.6` **Booleans and handlers.** A boolean reads as a state or a predicate
  (`isBusy`). For each public boolean, state what both values mean. When they select
  mutually exclusive configuration, layout, or rendering modes, the input should name
  the behavior category and expose all options as a bounded string union, rather than
  toggle one variant on or off: `density: 'comfortable' | 'compact'` describes the choice
  that `compact: boolean` hides; `sizing` describes the width choice that `fill` hides. Do not
  reject independent state, capability, or opt-in flags merely because two values exist.
  A public type change names the proposed input name, literals, default, and consumer
  migration. Classify the change under `schema.md` → "Defaults for recurring cases".
  A handler names the event it answers (`onDismissed`), not the work it does.
  **Literal boolean arguments.** `close(event, false)` hides what `false` means. Name it: an
  options key (`close(event, { restoreFocus: false })`), two named functions, or a union for
  modes. Keep the boolean when the function name already names it (`setOpen(isOpen)`), when
  forwarding state to a callback or emitter, or when the framework sets the signature. A
  private change is **fix**.
- `craft-1.7` **Types, custom properties, BEM elements.** Each passes the same meaning test
  as a TypeScript member.
- `craft-1.8` **Abbreviations.** An identifier, CSS class, custom property, or test helper
  with an unexplained abbreviation is a finding. Use full, descriptive names, with the
  exception for short lambda parameters in repo profile → `angular`
  → Angular conventions.
- `craft-1.9` **Coined terms.** A word the codebase and its policies do not otherwise use is
  a finding, even when the folder already contains it.
- `craft-1.10` **No type-suffix noise.** `Data`, `Info`, `Obj`, and `Manager` add nothing to
  a name that already says what it holds. A
  suffix a stated convention requires keeps it: `Store` on a `SignalStore`, `Service` on an
  injectable, `Component` on a component class.
- `craft-1.11` **File, selector, and class agree.** Follow repo profile → `scss`
  → class prefixes and BEM naming. Keep the CSS block name aligned with the component
  selector stem, using the class prefix named by repo profile → `scss` or `conventions`.
  Check that a folder and
  its files name the responsibility they actually contain, so the tree guides a reader
  to the right owner. An extracted file or helper takes the plainest name a reader already
  knows: an established platform or repository term (`initial-focus`), an existing repository pattern
  (`validate-tab-panels`), or what the thing is (`link-surface-styles`). Never name it after its
  mechanism (`style-loader`, `enter-following-gesture`) or the extraction's local vocabulary
  (`caller`, `items`). A dedicated type-only contract module uses the `.types.ts` suffix. A spec filename
  identifies its production subject and topic, or
  fixture validation when no production subject is under test; do not infer a missing
  source file from a spec name or require one spec per source file.

**Classification.** A private or protected member, a local, or a test helper is **fix**. An
inner BEM element or custom property is **fix** when it is internal. Establish whether it
is a styling hook from its documented contract, alongside any consumers found with `git grep`.
An input, output, exported type, host class, block class, tracking-id shape, or public inner
surface follows `schema.md` → "Defaults for recurring cases". In-repo usage is partial evidence
for published packages. A rename row states the new name in its `Action` cell.

## 2. Subtraction and Angular practice

**Question:** what is here that does not have to be, and does what remains use the Angular
and TypeScript the workspace has settled on?

For every DOM node, public member, host binding, listener, state signal, computed, test
helper, and demo-only branch, ask what observable behaviour or cited contract would fail if
it were deleted; when the answer is none, report a **fix** row under the probe that covers
it. Removing a public member follows `schema.md` → "Defaults for recurring cases".
An unbound public member is retained when its spec or contract supports it; zero observed
consumers alone is not a deletion reason.
Prefer native HTML and CSS state, existing inputs, and consumer-owned composition over new
component machinery. Anything suspicious that stays is named in the `no findings`
evidence with what keeps it.

- `craft-2.1` **DOM.** Count the elements one default instance renders beyond the host. Each
  wrapper needs a one-clause justification, recorded at the owning source. A wrapper
  that only carries a class another element could carry is **fix**. Use `:host` for the
  component root (repo profile → `scss` → component styling).
  Compare a one-off wrapper and its styles with consumed internal
  helpers that own the same frame, geometry, or paint contract. Report duplication with
  concrete shared-contract evidence and a reuse or narrow-extension proposal; do not
  abstract merely similar markup. Classify the proposal by its actual behavior, rendering,
  and API impact under the central schema, verifying preservation when needed.
- `craft-2.2` **TypeScript shape.** A single-caller resolver that could be the input default,
  or an `effect()` replaceable by `computed`, is a finding. Every effect must
  reveal its purpose (`effect()`, each `afterRenderEffect()` phase, and each `afterNextRender()`
  or `afterEveryRender()` phase): keep an obvious call or assignment inline;
  give guards, multiple steps, cleanup, or dense logic a purpose-named private helper. Keep
  registration in the injection context and tracked reads in the callback. Multi-step code
  should reveal its phases. A useful one-caller intent helper need not be inlined. Judge
  owner legibility under `architecture-1.2`, `architecture-1.3`, and `architecture-1.11`.
  Line count alone is insufficient. Template decisions should scan clearly: move a dense predicate, fallback, or state decision to a purpose-named
  `computed()` when clearer, preserving short-circuit order and signal dependencies; leave
  simple comparisons, formatting, and ternaries inline. A named signal group is useful only
  if its full access path and wiring improve clarity and nested values stay reactive, not
  snapshots. When several computeds
  partition the same collection for one layout, prefer one named computed result. Match each
  part's shape to its cardinality: a single item for a unique position, an array for a
  collection. Keep derivations separate when they have different dependencies or
  responsibilities. Do not add a generic presentation object merely to hide fields
  (repo profile → `angular` → components and signal state).
  Declare template-only members `protected` and use `readonly` where the field is never
  reassigned. Apply the template and member conventions in
  repo profile → `angular` →
  template conventions and member order.
  Follow repo profile → `conventions` for assignment style. Plain `??` fallbacks
  remain valid.
- `craft-2.3` **Bindings and listeners.** Every host binding, listener, signal, and computed
  must protect a behaviour the native element cannot express; prefer native properties and
  CSS pseudo-classes over state mirroring `:hover`, `:active`, `:focus`, or `:disabled`.
  A hand-rolled timer, focus-origin, or listener lifecycle that a sibling owner already holds
  is judged under `architecture-1.6`; here, check only that it is cleaned up.
- `craft-2.4` **Modern Angular surface.** `inject()` field initialisers rather than
  constructor parameters — a constructor that injects, subscribes, or derives state is a
  finding — no explicit `standalone: true`, `ChangeDetectionStrategy.OnPush`,
  `input()`/`output()`/`model()` rather than decorators, every input and model declared
  before the first output (repo profile → `angular`
  → member order),
  `host: {}` rather than
  `@HostBinding`/`@HostListener`, and `@if`/`@for`/`@switch` rather than the structural
  directives (repo profile → `angular` → Angular conventions and
  components).
- `craft-2.6` **Types and escapes.** Include related spec files for this probe, including in
  section 2 shards. Preserve known type evidence: use inference or
  `satisfies` where it checks a contract without widening a value and asserting it back.
  Remove avoidable or chained casts by narrowing the actual value or correcting the owning
  contract. Prefer typed property access to `Reflect.get` for a statically known property.
  At DOM and third-party seams, retain runtime guards when the value can be absent or
  malformed despite its TypeScript declaration. Keep `unknown` plus guards and open
  dictionaries for genuinely untrusted input
  (repo profile → `angular` → TypeScript types).
  For a necessary assertion, state any non-obvious invariant locally under
  repo profile → `comments`; no marker phrase is required. Distinguish deliberately
  invalid negative-test fixtures from production escapes; other test casts get the same
  review as production casts. Call intentional widening a defect only with a concrete,
  clearer, compatible alternative; anonymous return types and `Record` are not defects
  on their own. No `any` anywhere (repo profile → `angular` →
  TypeScript types). A non-null assertion that hides a possible absent value is a finding. Otherwise
  require a local reason for the invariant. Preserve runtime guards when the type cannot
  guarantee presence.
- `craft-2.7` **Unused surface.** An unused import, an input or output with neither bindings
  nor a supported contract, a `computed` no template reads, and a CSS class no template applies
  are each a finding. An unbound documented public member is no finding without a concrete defect.
  Check TypeScript, templates, and stylesheets, including unused bindings.
- `craft-2.9` **Subscriptions.** Every subscription has a teardown,
  `takeUntilDestroyed(destroyRef)` or the async pipe, never a manual `ngOnDestroy`
  unsubscribe (repo profile → `angular` → RxJS subscriptions). A
  stream that only feeds a template is a signal or a `computed` instead.
- `craft-2.10` **Duplicated branches and derivations.** Two `@if` arms, two `@for` bodies, or a
  block repeated once per variant, differing only in a binding value, collapse into one
  block with that value bound. The same applies to TypeScript: two members that repeat the same
  derivation steps and differ only in their final expression share one purpose-named `computed`
  or helper for the common steps; do not merge them into one function switched by a flag. For
  component templates, test whether semantic structure, descriptive
  classes, and clear bindings make the parent scannable, whether a comment helps locate a
  meaningful row, slot, section, or region, or whether a private cohesive component saves more
  reading than its wiring costs. A finding requires actual reading difficulty and a
  demonstrably clearer full alternative; length, single use, or lack of comments alone
  does not suffice. Keep output, DOM, styling, focus, queries, and type checking in view when
  classifying the change.
- `craft-2.12` **Nesting.** In TypeScript, a branch more than three deep, or a happy path indented
  under its guards, is a finding. Remedies in order: invert guards into early returns; merge conditions
  that validate one concern; name a compound condition (`craft-1.1`); extract the body when the
  function no longer reads as a summary of its steps. Template depth past three triggers
  `craft-2.10`'s boundary test by
  itself; normal template bodies under `@if` or `@for` are not guard-inversion findings.
  **Fix** when evaluation order and signal dependencies are statically unchanged.
- `craft-2.11` **API and demos.** A public member used only by the demo is a finding only when
  its spec or contract does not support it; a documented variant or valid public surface is not
  demo-only debt. For a member with one composed-component consumer, try moving the
  responsibility into that composition first.

## 3. CSS shape and tokens

**Question:** does the stylesheet state each rule once, in the shape its policy names?

Follow repo profile → `scss` → class prefixes, BEM naming,
design tokens, and component styling. Use class prefixes recorded by repo profile → `scss` and `conventions`.

- `craft-3.1` A modifier scale (`--sm`/`--md`/`--lg`, focus-ring widths) is declared once
  per step. Use a size-agnostic `:host` with only the declarations every step shares, then
  declare each size's values in its modifier rule.
- `craft-3.2` N identical declaration blocks differing only in the variant selector collapse
  into one shared rule: `:host(:active)` replaces four `:host(.widget--v:active)` copies when
  the declarations match, and `@media (prefers-reduced-motion)` lists shrink with it. A
  variant × state matrix, or a formula differing between size steps only in which token it
  reads, assigns variables by role in each variant, then uses one rule per state. A state
  rule repeated per variant is a finding.
- `craft-3.3` `!important`, global selectors, and `::ng-deep` outside a `:host`-scoped
  third-party or child override are findings. Scope every override under `:host` or the
  component selector and reach only the internals the override needs
  (repo profile → `scss` → child overrides).
- `craft-3.4` **CSS variables.** Prefer direct properties. Name the shared relationship,
  formula, or state rule each variable enables, and inline aliases that add indirection
  without shared logic. Size or variant differences alone do not justify a variable.
- `craft-3.5` **One block per selector.** A selector's paint and its transition live in one
  block. No two rule blocks share a selector.
- `craft-3.7` Every colour, spacing, and typography value uses the repo's design tokens when available
  (repo profile → `scss` → design tokens).
  A raw hex, `rgb()`, `hsl()`, or magic number is a finding unless its why is recorded at
  the owning source. Trace aliases to the source token and flag direct use of a base value
  where an existing token already names the intended role.
- `craft-3.8` Every text-bearing element applies the whole typography style. Trace aliases to the repo's typography tokens, if present.
  Use the family, size, and weight together. If using a `font` shorthand, include the style's matching
  letter-spacing and any required text transform. Read every `font` declaration. A bare
  shorthand missing those properties is **fix**, with the missing properties named in the
  Action cell.
- `craft-3.9` Check the complete default, hover, focus, pressed, disabled, loading, and error
  set that applies. A state with no rule, or a rule no state can reach, is a finding.
- `craft-3.10` No `[style.*]` bindings from TypeScript for values a class modifier enumerates.
  Apply the modifier to represent the design choice and keep the declaration in SCSS.
- `craft-3.11` A stylesheet that styles more than a couple of elements is grouped into
  semantic sections in DOM order, each with a one-line header comment; each variant or state
  rule sits directly after the base rule it overrides; a comment explaining one rule sits on
  that rule. Reordering
  is **fix** only when the compiled-specificity and source-order winner of every rule pair
  stays the same; otherwise state the pair that changes.

## 4. Performance

The [`performance`](performance.md) packet owns performance; this packet reports nothing under
§ 4.

## 5. Comments

**Question:** does each comment carry a why the reader cannot recover from the code?

- `craft-5.1` Apply repo profile → `comments` → comment rules and doc comments:
  default to no comment; explain non-obvious why in one or two lines, never what/how. A public
  doc comment states the consumer contract; an implementation comment states a constraint,
  trade-off, or assumption. Put component-selection guidance in the consuming documentation. "Non-obvious" is judged for a
  competent Angular practitioner: documented framework rules and compiler errors are not
  comment-worthy. Judge HTML section landmarks with `craft-2.10`.
- `craft-5.2` Delete comments restating an identifier, nearby line, icon, binding, helper
  name, or meaning recoverable from expressions and member doc comments; rename under § 1 if
  needed. An HTML landmark can name a meaningful row, slot, section, or region even when
  its class does, if nested markup or branches benefit. Do not require headings throughout.
- `craft-5.4` Repeating a rationale that already lives in a member's doc comment, the spec,
  or a related file is a finding. A brief local constraint plus a source pointer is justified
  when an apparently harmless simplification could break behaviour.
- `craft-5.5` Add a missing why for surprising code, especially timing or lifecycle constraints
  beside the operation. Zero comments is not a goal; ordinary bindings and tokens need none.
- `craft-5.6` A comment explaining a past version, a migration, what changed, that the code
  was generated, or how a gate was met is a finding
  (repo profile → `comments` → comment rules).
- `craft-5.7` A bare TODO, a work-item reference outside a TODO, or a PR or bug number
  anywhere in a comment is a finding
  (repo profile → `comments` → comment rules).
- `craft-5.8` A term coined for the comment, matching no symbol and no established usage in
  the folder, fails the same test § 1 applies to names.
- `craft-5.9` Commented-out code is a finding. Delete it; git holds the version that ran.
- `craft-5.10` A doc comment walking the reader through control flow or restating the
  signature is a finding regardless of its tags. This probe checks whether the summary
  states the caller contract. The public component contract review belongs to a repo contract packet.
- `craft-5.11` A lint- or type-suppression comment (`eslint-disable-next-line`,
  `@ts-expect-error`, `@ts-ignore`) whose line can be rewritten to not need it is a finding:
  prefer the type-accurate expression over suppressing the rule. `!= null` on a
  `T | undefined` value (the type excludes `null`) becomes `!== undefined`, satisfying
  `eqeqeq` with no disable. A suppression that is genuinely required states, in its trailing
  reason, the constraint that forces it — not the rule name and not what the line does.

## 6. Tests and specimens

**Question:** does each test say which behaviour it protects, and does each retained helper
and demo-only branch earn its place?

- `craft-6.1` A spec name states the behaviour under test, not the method that implements it:
  `it('keeps focus on the trigger after dismissal')`, never `it('calls onDismiss')`.
- `craft-6.2` One intent per `it`. A test pinning several unrelated behaviours splits; several
  assertions that together pin one behaviour stay in one `it`.
- `craft-6.3` A test that only asserts the component was created is a finding: replace it
  with the first behaviour the spec or doc comment states, or delete it.
- `craft-6.4` The wrong testing stack for the folder is a finding. Use the test stack in the repo profile
  for unit tests and Spectator where the area already uses it. Set mutable host
  inputs through signals when testing a signal-driven host. Use the repo's browser and visual test projects, when present, for those checks. For an extracted runtime
  owner, owner behavior belongs in its colocated spec. The parent retains public wiring and
  cross-owner integration tests. Type-only modules need no runtime spec.
- `craft-6.5` Every test helper is read by more than one assertion, or it is inlined.
- `craft-6.6` Every demo-only branch renders a state the documented contract lists.
- `craft-6.7` A tautological or implementation-coupled test is a finding: one whose expected
  value is derived the same way the code derives it, or one that asserts a collaborator was
  called (count or arguments) instead of an observable result through the public surface.
  Replace it with an independent literal expectation, or an assertion on rendered output or
  emitted values.

## 7. Other material concern

- `craft-7.1` Use independent judgment to identify a material craft or maintainability concern
  this packet's named probes miss. Apply the shared wildcard rule; a stylistic preference alone
  is not evidence of a defect.

## Classification

Classify by [`schema.md`](../schema.md) → "Classifying a row". A simplification is **fix**
only when static review shows behaviour, rendered output, and every documented rule unchanged; one
that needs a render to confirm identical output is **verify**.
