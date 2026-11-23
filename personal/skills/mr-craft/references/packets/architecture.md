# Packet: architecture

Apply this packet to Angular and TypeScript targets listed in the repo profile. Read
[`../schema.md`](../schema.md) → "Review scope", then related consumers, implementers,
and rationale only; name bounded reading in the evidence.
This design review excludes PR fetching, backend expansion, and style, naming, comment,
coverage, or line-level findings. A severe unrelated security or data-loss concern may appear
under “Outside this review's scope”. For evidenced security concerns, cite the applicable
trust boundary or invariant, when it applies, and the plain-language consequence. Published
repository component contracts and repository rules remain authoritative.

Start with the stated purpose in the request, design, doc comment, contract, or example. Missing
necessary evidence is readiness, never an invented goal or pass; still judge visible usage.
A spec `## Architecture` diagram or family `ARCHITECTURE.md` states the design: compare source,
owners, and edges under `architecture-1.3`, `1.4`, and `1.6`, including linked nested flows.
Ask for a focused diagram only when an overview hides a distinct flow or lifetime. Report
disagreement on whichever side is wrong; a stated claim is a judgment yardstick, not policy.

Report per [`../schema.md`](../schema.md) → "Architecture rows" and "Classifying a row": each
concern gets `Class:`, evidence, contract violation or claim-based judgment, affected user and
condition, concrete alternative, recommendation, and adoption timing. Keep multiple labelled
concerns in one probe row; no finding quota. Judge breaking and non-breaking alternatives equally.
Each Action states `Compatibility: breaking (<n> in-repo consumers: <paths>; external consumers affected)`,
`Compatibility: breaking (<n> in-repo consumers: <paths>)` for repository-only contracts, or
`Compatibility: non-breaking`. Check repository uses with `git grep` and the package's
published surface. Describe migration separately.

## Abstraction judgment method

Form an independent assessment against the user's goal and actual use before mapping concerns
to the baseline probes. Use architectural judgment to choose the material concerns; the probes
provide coverage, not a limit on recommendations. Keep a compact inventory of central public
abstractions and internal responsibilities with their owners and source evidence, including
responsibilities within a class and the sibling behavior owners (controllers, directives,
services, internal helpers) of the same family or library. Existing filenames alone do not
define those boundaries.

For a concrete responsibility, compare the forms that could own it:

- Keep obvious glue and small calculations local.
- Use a plain `.ts` function for a cohesive deterministic transformation.
- Use a plain `.ts` class for cohesive stateful logic with explicit dependencies and no need for
  an Angular template, injection, or Angular-managed lifetime.
- Use a component-scoped Angular factory or controller for reactive state, effects, or cleanup;
  it may use signals, `inject`, and `DestroyRef`. A plain `.ts` filename does not make it
  framework-free.
- Use a private subcomponent for cohesive rendering or interaction behind a small typed contract.

These are alternatives, not steps. Compare tracing, dependencies, API, tests, DOM, CSS, focus,
and lifetime with the local option. Size and speculative reuse do not decide; one caller can
justify a real responsibility. A generic store or `withFeature` needs a concrete benefit. For
extracted runtime owners, test owner behaviour and parent integration separately. Type-only
contracts need no empty runtime spec.

A one-caller private boundary can earn its place through cohesion, ownership, lifetime, or
change isolation when its seam costs less than local work. For HTML templates, compare existing structure, a section landmark,
and a private component, including its typed contract, host DOM, CSS, focus, queries,
accessibility, and lifetime. Neither length nor single use decides; `angular` owns comment
wording. Give shared resources one owner while allowing coordinated composition. A short scan
of the public entry and each owner should reveal duty, state, and flow. Helpers or folders do
not excuse a sprawling coordinator or multi-responsibility owner; file length alone proves neither.

A proposed or retained reuse-driven abstraction needs at least two named, real sites with the
same stable invariant and a clearer, more concise full solution than a local explicit
alternative. Lack of either is evidence to recommend inlining or removal, including when only
one caller uses it; name the concrete local alternative. This threshold governs sharing
for reuse, not the responsibility boundaries above. Compare the call sites,
implementation, configuration, hooks, types, and indirection—not only extracted line count.
Similar syntax or possible future reuse is insufficient evidence. Apply the same two-site,
stable-invariant, clearer-full-solution threshold when adapting or composing an existing
owner; examine duplicated interaction mechanics under `architecture-1.6`.

Prefer composition, a private helper, or a directive for implementation sharing. Inheritance
needs a common stable behavioural, state, and lifecycle contract that every child obeys, with
honest hooks and no irrelevant overrides or defaults. Keep implementation sharing private where
possible; public siblings and types should preserve real domain differences rather than collapse
to a weakest common API. Independent domains, change cadence, or failure semantics can justify
small duplication when the difference is named, not inferred from separate files. Do not replace it with flags, modes, or optional-hook growth merely to remove
repeated code. Stop extracting when tracing costs exceed clarity. A necessary external or API
boundary is distinct from reuse-driven extraction and does not excuse hypothetical reuse. State
the evidence, local alternative, and both costs; do not automatically rewrite valid inheritance.

### Splitting behaviour within a component

Reuse is one reason to extract; reading clarity is another, and a single caller is enough for
it. Walk this ladder for each member cluster found under `architecture-1.2`:

1. **Is it a separable cluster?** It holds its own state, handlers, timers, listeners, or
   lifecycle that the rest of the component does not write, and the component reads it through
   a narrow seam of one to three values or calls. If either fails, keep it inline.
2. **Does the split pay?** Stop when the parts would write each other's state, when the owner
   would take most of the component's inputs as a bag of signals, or when the behaviour is short
   enough that a file hop costs more than reading it inline.
3. **Choose the form by what it owns:**
   - a pure calculation (ranges, clamping, layout maths) becomes a plain function;
   - stateful behaviour that needs DI or cleanup but owns no element becomes an `inject…()`
     controller function or small class;
   - behaviour that owns an element's events, host bindings, and ARIA becomes an internal
     directive.
4. **Place it** beside its component while it has one caller, in a family-local internal
   folder when a sibling in the family shares it, and in the package's shared internal
   area when used across families (`architecture-1.6`).

The split is a finding when the component reads clearer afterwards and each owner is testable
on its own. Name the cluster, its seam, and the chosen form, and move its tests with it. Keep the parent integration test.

## Baseline probes

- `architecture-1.1` **Purpose and caller benefit.** Does each central abstraction deliver the
  stated benefit to a caller, including optional capabilities, or merely give a name to an
  otherwise unuseful shape?
- `architecture-1.2` **Responsibilities and meaning.** Are responsibilities cohesive and are
  shared names and operations semantically consistent across implementers? Test the author's
  examples, exceptions, notes, and workarounds against the stated rule. Inventory the effects,
  mutable fields, event handlers, and substantive operations **within** the main component and
  each extracted owner. Can a reader name each file's duty and follow its state changes from a
  short scan? Flag a coordinator that still implements most behaviors, or an owner that absorbs
  several unrelated lifetimes, even when the directory contains helpers. Group the members by the
  state they read and write; judge each cluster with its own state, handlers, and lifecycle
  under "Splitting behaviour within a component", which needs no second caller.
- `architecture-1.3` **Dependency direction and placement.** Do dependencies follow the target's
  layer and scope contracts, and do cycles, back-edges, or reach-through ownership make change
  harder? Does the actual tree reveal cohesive responsibilities at a glance, with closely related
  implementations, tests, and types together and the public entry and main component easy to find?
  When a package barrel exports shared types, preserve their public names and export them
  from the defining modules. Component implementations import the types they use without
  forwarding them. A private
  component-file forwarder is not package API. Judge placement by actual responsibility
  and change paths. Keep same-family shared code together before using a wider shared area.
  Recommend
  relocation only for a concrete scanning/change-path defect or stated goal. Trace source
  replacement, rendered-page, and location/passage-reveal changes where present through source
  and tests. Compare retained public-entry work with extracted owners; a renamed controller or
  callback bag alone does not simplify dependencies.
- `architecture-1.4` **Ownership and lifetime.** Where relevant, is the source of truth,
  ownership, lifetime, and concurrency model explicit and compatible with the enclosing app?
- `architecture-1.5` **Flow and recovery.** Where relevant, do data flow, asynchronous work,
  failure boundaries, and recovery behaviour preserve the stated contract?
- `architecture-1.6` **Composition and extension.** Does the design share only the stable
  behaviour, state, and lifecycle its consumers need, through composition or honest extension,
  without exposing private implementation or coupling every consumer to one implementation?
  Projection needs a justification that holds and is never the default: a parent whose consumers
  project one public child type per item exposes its implementation and should own the items
  through a typed array input. Review public compatibility
  before changing the API.
  Before accepting a hand-rolled timer, hover grace, cancellation, focus-origin
  (`FocusMonitor`), listener, or dismissal mechanism, or a hand-wired ARIA widget pattern
  (separator, slider, listbox, disclosure) with its pointer and keyboard handling, inventory
  the sibling owners already
  holding that mechanic and compare it per mechanism: trigger, state, timing, cancellation,
  focus handling, and cleanup. Rendering, ARIA, and the interaction contract (what opens,
  what dismisses, Escape, click) are component policy and may differ. Concrete duplicated
  behavior at `file:line` in two owners requires comparison even when those policies differ:
  determine whether the underlying mechanic has a stable shared invariant. Compare adapting
  or composing the existing owner through a narrow seam for each caller's policy and surface
  with keeping the behavior local and with a new helper. Recommend reuse only when its full
  solution is clearer; name any contract difference that changes the mechanic. A required
  extraction preserves each documented
  interaction contract, cleanup, and public compatibility, carries owner and
  parent-integration tests classified per `schema.md`, and names its real consumers.
  Coincidental syntax, a shared look, or applying one component's directive to another's
  surface is not evidence. Classify each concern through `schema.md` → “Classifying a row”;
  differing interaction contracts alone do not require **decide**.
  On a public component's own host element, keep constructor-time `FocusMonitor.monitor()` with
  `stopMonitoring()` on destroy rather than `hostDirectives: [CdkMonitorFocus]`. The host
  directive puts CDK's directive on the public host: a consumer's own `cdkMonitorElementFocus`
  or `cdkMonitorSubtreeFocus` there throws NG0309, and `inject(CdkMonitorFocus)` and the
  `cdkMonitorFocus` exportAs resolve on it. It also starts monitoring only in `ngAfterViewInit`.
  `cdkMonitorElementFocus` on an element inside the component's own template is fine.
- `architecture-1.7` **Contracts and defaults.** Do types, semantics, defaults, and
  substitutability preserve real domain differences and capabilities for valid callers, rather
  than forcing every caller to the weakest implementation's limitations, irrelevant defaults,
  overrides, or hooks?
- `architecture-1.8` **Operating boundaries.** When architecture-relevant evidence exists, do
  performance and scaling assumptions, and security or trust boundaries, hold at the ownership
  boundary? Otherwise record why this probe is not applicable.
- `architecture-1.9` **Change path.** Does the design support migration, focused tests, and
  isolated change at the cost appropriate to its likely adoption? Identify foundations that are
  cheaper to correct before more consumers adopt them. Name the files and tests a likely source,
  render, or reveal change would touch. Judge whether each change stays with a bounded owner or
  requires following and editing a broad coordinator and several unrelated owners.
- `architecture-1.10` **Other material concern.** Report a concern outside this baseline only
  when concrete evidence ties it to a stated goal or established contract. Do not manufacture a
  principle or a finding to fill this row.
- `architecture-1.11` **Necessity and simpler alternative.** Does the abstraction, layer, or
  mechanism earn its added responsibility against the fixed goal and constraints? Apply the
  abstraction judgment method where relevant: compare concrete real sites and a simpler local,
  private, or compositional alternative with their tracing and change costs. For template
  boundaries, describe the parent section and the first sufficient option from the
  abstraction judgment method;
  do not demand a component merely because the template is long or demand inlining merely
  because a private component has one caller. A hand-rolled copy of a mechanic an existing
  sibling owner holds is judged under `architecture-1.6`. A purpose-named private phase helper can earn its
  place with one caller by making the containing flow readable; judge it as an intent boundary,
  not a proposed reusable abstraction. Apply the deletion test: imagine deleting the abstraction; if the complexity vanishes it was a pass-through, so inline it; if it reappears across callers it earns its place. Compare the complete call path and the types, callbacks,
  and configuration a caller must supply with the original method. An extraction that moves the
  same sprawling flow behind a large interface or one replacement controller has not reduced the
  reader's burden. Do not force subtraction when the stated constraint requires the design.

## Extension guidance

This is an open-ended baseline, not an exhaustive checklist. Add a narrowly named probe when a
repeated architecture concern needs durable coverage. Give it the `architecture-N.n` form,
state its evidence standard and boundaries, and preserve the one-row coverage rule.

## Classification

Classify each concern by [`../schema.md`](../schema.md) → "Classifying a row" and "Architecture
rows". Use **fix** when static evidence establishes that the design change preserves behaviour,
rendering, and public API. Record readiness when evidence needed to assess a stated purpose is
missing. Apply the recurring compatibility cases to published surfaces.
