# Packet: Angular craft

Apply this packet to Angular and TypeScript targets listed in the repo profile, including
their consumed code. Apply testing probes to the target's tests when relevant.

Follow [`../schema.md`](../schema.md) → "Review scope" and its report schema. Judge consumed
files by the target's use and read each cited rule. Use repo profile → `conventions` →
imports, class prefixes, and package manager; use `angular` → interop and stores.

## 1. Names

**Question:** does every name say what the value means to the reader, rather than where it
came from or how it was produced?

- `craft-1.1` **Names reveal purpose.** A name whose role is unclear in the tree or at the call site
  is a finding. Check folders and identifiers in the target and consumed owners, including
  types, custom properties, and BEM elements. Name the role, such as a caption's `actionLabel`,
  and cite the caption's binding and rendered use. Name conditions or intermediate values
  when that clarifies intent and preserves evaluation order and signal dependencies.
- `craft-1.2` **Effective-value pattern.** A fallback chain over an input, a context value,
  and a default is one `computed` named after the role: the context value takes a private
  name (`#formFieldSize`), the chain the role name prefixed `effective` (`effectiveSize`),
  and neither is named after its source.
- `craft-1.5` **Consistent vocabulary.** Competing terms for one concept across the target and its
  composed components are a finding. Use one established term and keep distinct states
  distinct. Apply the state vocabulary and exceptions in the repo profile's rule sources.
  Keep platform and third-party names in their own API contexts.
- `craft-1.6` **Boolean intent.** An opaque boolean argument is a finding. Name it with an options
  key or split the operations (**fix** for a neutral private change). Keep clear state and
  opt-in flags, state forwarding, and framework signatures. Name a handler for its event.
  State what both values of a public flag mean. Give mutually exclusive public modes a named,
  bounded union with its literals, default, and migration per
  `schema.md` → "Defaults for recurring cases".
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
- `craft-1.12` **Native attribute names.** A component input named after a global HTML or ARIA
  attribute (`title`, `id`, `hidden`, `role`) is a finding: a static value also stays on the host
  as a native tooltip, duplicate id, or extra accessible name. Name the role (`heading`, `label`);
  when a published contract fixes the name, clear the host attribute (`'[attr.title]': 'null'`)
  with a spec. A directive whose purpose is that attribute keeps the name.

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

- `craft-2.1` **Necessary wrappers.** Count elements beyond the host in one default instance. A
  wrapper with no distinct rendering or behaviour is a finding. Move its work to an existing
  element when equivalent (**fix**). Use `:host` under the repo profile's `scss` styling rules.
  Keep wrappers with a needed contract and record the rationale at its owner. Merely similar
  markup is not abstracted. For a shared wrapper contract, use `architecture-1.6` with evidence
  and a reuse or narrow-extension proposal. Classify and verify under the schema.
- `craft-2.2` **Readable derivations and effects.** A resolver that only supplies an input default or
  an effect that only derives state is a finding. Use the input default or a `computed`,
  respectively. For side effects and render callbacks, keep obvious operations inline and
  give complex phases purpose-named private helpers. Preserve injection context and tracked reads.
  Use `craft-2.10` for
  template boundaries and keep short-circuit order and signal dependencies when moving logic.
  See `architecture-1.2`, `architecture-1.3`, and `architecture-1.11` for owner and helper legibility.
  Group signals only when access is clearer and nested reads stay reactive. Combine partitions of
  one collection for one layout when the result reads more clearly and each part retains its cardinality. Keep
  derivations with distinct dependencies or roles separate. Apply repo profile → `angular` for
  member conventions: use `protected` for template-only members and `readonly` for fields that
  never change where required. Use repo profile → `conventions` for assignment style. Where it
  requires explicit assignments, compound or logical assignment is a finding. Plain `??` stays valid.
- `craft-2.3` **Bindings and listeners.** Every host binding, listener, signal, and computed
  must protect a behaviour the native element cannot express; prefer native properties and
  CSS pseudo-classes over state mirroring `:hover`, `:active`, `:focus`, or `:disabled`.
  A hand-rolled timer, focus-origin, or listener lifecycle that a sibling owner already holds
  is judged under `architecture-1.6`; here, check only that it is cleaned up.
- `craft-2.4` **Angular conventions.** Departures from applicable Angular conventions are findings.
  Apply repo profile → `angular` for component metadata and public member order. Prefer
  field injection, standalone components with `OnPush`, signal-based APIs, host metadata, and
  built-in template control flow.
  A constructor that injects, subscribes, or derives state is a finding.
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
- `craft-2.7` **Unused surface.** An unused binding, private member, or style rule is a finding after
  checking template, host, runtime, and consumer use. Use the repo profile's unused-binding check where
  available. An unused or demo-only public member is a finding when its contract does not support
  it. Keep documented surfaces. For a member with one composed-component consumer, check
  whether the composition can own the responsibility while preserving supported use.
- `craft-2.9` **Subscription lifetime.** A subscription that can outlive its owner is a finding.
  Apply repo profile → `angular` → RxJS subscriptions. Tie manual subscriptions to the owner
  lifetime with `takeUntilDestroyed` or an equivalent, never a manual `ngOnDestroy`
  unsubscribe. Keep an async pipe that owns teardown. Use signals or a `computed` for local
  derivation.
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
- `craft-3.3` **Selector reach.** An override that violates the owning style boundary is a finding.
  Apply repo profile → `scss` → child overrides. Keep permitted overrides, such as for composed
  layout, within that boundary. Without a local rule, scope overrides to the host or component
  selector and reach only the internals they need. Flag avoidable specificity escapes.
- `craft-3.4` **CSS variables.** Prefer direct properties. Name the shared relationship,
  formula, or state rule each variable enables, and inline aliases that add indirection
  without shared logic. Size or variant differences alone do not justify a variable.
- `craft-3.5` **One block per selector.** A selector's paint and its transition live in one
  block. No two rule blocks share a selector.
- `craft-3.7` **Scoped tokens.** Apply repo profile → `scss` → design tokens and use its deterministic
  check where available. Trace aliases to their source. A raw style value or base token is a
  finding when an existing token names the intended role. Keep a raw value only where the
  rule permits it and record the local constraint at its owner.
- `craft-3.8` Every text-bearing element applies the whole typography style. Trace aliases to the repo's typography tokens, if present.
  Use the family, size, and weight together. If using a `font` shorthand, include the style's matching
  letter-spacing and any required text transform. Read every `font` declaration. A bare
  shorthand missing those properties is **fix**, with the missing properties named in the
  Action cell.
- `craft-3.9` **State rule coverage.** A required state treatment with no rendering source or a
  state rule that cannot match is a finding. Supply the missing treatment or remove the
  unreachable rule. Count native, base, and shared styles that render the required state.
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

- `craft-5.1` **Missing rationale.** An unexplained constraint a competent reader cannot recover
  from code, such as a timing assumption, is a finding. Explain it beside the operation in one
  or two lines under repo profile → `comments` → comment rules. Ordinary bindings and documented
  framework rules need no comment. See `craft-5.10` for doc comments and `craft-5.2` for landmarks.
  Put component-selection guidance in the consuming documentation.
- `craft-5.2` **Redundant narration.** A comment whose meaning is recoverable from code is a finding.
  Clarify the name or type when it can carry that meaning, then remove the comment. Keep
  non-obvious rationale under `craft-5.1`. Keep template landmarks that help readers locate
  meaningful sections, including sections named by a class. See `craft-2.10` for template boundaries.
- `craft-5.4` Repeating a rationale that already lives in a member's doc comment, the spec,
  or a related file is a finding. A brief local constraint plus a source pointer is justified
  when an apparently harmless simplification could break behaviour.
- `craft-5.6` **Present-state comments.** A comment narrating implementation history, gate
  mechanics, or that the code was generated is a finding. Remove it under repo profile →
  `comments` → comment rules. Keep a valid removal TODO for genuinely temporary code.
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
