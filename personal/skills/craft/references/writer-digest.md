# Writer digest

Read this digest and the assigned packet sections before editing. The packet governs
where they differ. Read the relevant `angular`, `scss`, `i18n`, `comments`,
`component-library`, and `conventions` roles in the repo profile. Keep probe ids stable
and keep fixes scoped to the
handed concern keys when refining.

## angular

- `craft-1.1` Name each value for its role, so a reader at the call site can understand it
  without opening its declaration.
- `craft-1.5` Use one word per concept, and keep `active`, `selected`, and `focused` to their
  ARIA meanings.
- `craft-1.6` Don't pass a literal `true`/`false` the function name doesn't explain; use an
  options key (`{ restoreFocus: false }`), two named functions, or a union.
- `craft-1.8` Spell out names per repo profile → `angular` →
  Angular conventions.
- `craft-2.2` Prefer an input default or `computed` to a one-caller resolver or `effect()`
  → repo profile → `angular` → signal state.
- `craft-2.12` Guards first, branches at most three deep.
- `craft-3.11` Group a larger stylesheet into headed sections, each state rule after its base
  rule.
- `craft-5.1` Comment only a non-obvious why, in one or two lines; default to none
  → repo profile → `comments` → comment rules.
- `craft-5.2` Delete a comment that restates its name or narrates the next line, or rename
  until it is unneeded → repo profile → `comments` → comment rules.
- `craft-5.4` State a rationale once, where it already lives, and point to it elsewhere
  → repo profile → `comments` → comment rules.
- `craft-5.10` Keep a doc comment to the consumer contract, never a walk through the body
  → repo profile → `comments` → doc comments.
- `craft-6.1` Name each test for the behaviour it protects, never the method it calls.
- `craft-6.2` Give each `it` one intent. Split unrelated behaviours.
- `craft-6.7` Assert independent literals or rendered output, never a value derived as the code
  derives it or that a collaborator was called.

## performance and correctness

- `perf-1.2` Build a `Map` or `Set` once instead of a `find`, `filter` or `includes` inside a
  loop → [`performance.md`](packets/performance.md) → "1. Data work".
- `perf-1.8` Compute state-only work when that state changes, never inside a library's per-row
  or per-cell callback → [`performance.md`](packets/performance.md) → "1. Data work".
- `perf-2.8` Let a pointer, hover, scroll or input event touch only the items it changes
  → [`performance.md`](packets/performance.md) → "2. Reactivity".
- `perf-2.4` Bound any `@for` over a growing collection with pagination or virtual scrolling
  → [`performance.md`](packets/performance.md) → "2. Reactivity".
- `perf-7.1` Name any growing input or repeated cost the named probes miss, such as a large
  subtree rebuilt on each mode switch → `schema.md` → "Wildcard rule".
- `correct-7.1` Name any failing input or sequence the named probes miss, with the correct
  result → `schema.md` → "Wildcard rule".

Published component contracts are outside this digest. Use the repo skill hand-off in
[SKILL.md](../SKILL.md) when the repo profile lists a contract packet. Follow the test
stack and import conventions in the repo profile. Return one `applied` or `returned`
line per handed concern key. The orchestrator runs scoped gates.
