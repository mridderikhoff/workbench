# Writer digest

Read these recurring probes with the assigned packet sections before editing. The packet
governs if an entry differs. Read the relevant rule sources in the repo profile. Keep probe
ids stable and scope refine edits to the handed concern keys.

## angular

- `craft-1.1` Name folders and identifiers for their roles so the tree or call site explains them.
- `craft-1.5` Use one term per concept and keep distinct states distinct. Follow the repo profile's state vocabulary.
- `craft-1.6` Name opaque arguments, such as `{ restoreFocus: false }`, and give exclusive modes a typed union.
  Keep clear state and opt-in flags, state forwarding, and framework signatures.
- `craft-1.8` Spell out names. Keep abbreviations allowed by repo profile → `angular` → Angular conventions.
- `craft-1.12` Name inputs for their role, not after a global attribute such as `title` or `id`.
- `craft-2.2` Use input defaults for default-only resolvers and `computed` for derivations.
  Give effects and render callbacks a clear purpose → repo profile → `angular` → signal state.
- `craft-2.12` Use early guards and at most three branch levels in TypeScript. Use `craft-2.10` for template boundaries.
- `craft-3.11` Group larger stylesheets into headed sections in DOM order. Put variant and state overrides
  directly after their base rule.
- `craft-5.1` Explain a non-obvious constraint beside the operation in one or two lines.
  See `craft-5.2` for template landmarks.
- `craft-5.2` Delete comments whose meaning the code already carries. Keep template landmarks that
  help readers locate meaningful sections.
- `craft-5.4` State each rationale at its source. Where an edit might break behaviour, state the
  brief local constraint and point to that source.
- `craft-5.10` Keep a doc comment to the consumer contract, never a walk through the body
  → repo profile → `comments` → doc comments.
- `craft-6.1` Name the behaviour a test protects, not the method that implements it.
- `craft-6.2` Split unrelated test behaviours. Keep assertions that establish one behaviour together.
- `craft-6.7` Assert independent expectations or public outcomes, such as emitted values.
  A mirrored derivation or collaborator call alone does not establish the behaviour.

## performance and correctness

- `perf-1.2` Index repeated lookups over the same collection once when a `Map` or `Set` preserves the answer.
  See [`performance.md`](packets/performance.md) → "1. Data work".
- `perf-1.8` Recompute state-only work when its inputs change, then read the result in library
  per-item callbacks → [`performance.md`](packets/performance.md) → "1. Data work".
- `perf-2.8` Keep high-frequency handlers and the work they trigger proportional to the items that change.
  See [`performance.md`](packets/performance.md) → "2. Reactivity".
- `perf-2.4` Bound lists that grow with user or server data. A supported volume bound passes.
  Use **verify** when volume is unknown → [`performance.md`](packets/performance.md) → "2. Reactivity".
- `perf-7.1` Name a material cost the probes miss and the input or resource that drives it.
  Verify repeated subtree work at representative volume → `schema.md` → "Wildcard rule".
- `correct-7.1` Name a material wrong result the probes miss, its triggering input or sequence,
  and the correct result → `schema.md` → "Wildcard rule".

Published component contracts are outside this digest. Use the repo skill hand-off in
[SKILL.md](../SKILL.md) when the repo profile lists a contract packet. Follow the test
stack and import conventions in the repo profile. Return one `applied` or `returned`
line per handed concern key. The orchestrator runs scoped gates.
