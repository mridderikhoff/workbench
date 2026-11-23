# Provenance

This portable skill derives from two repository skills. The primary source is
`cl-strategy/.agents/skills/ds-craft` on `t3/improve-ds-craft-content` at `0294bfd50a`. The secondary source is
`cl-system/.claude/skills/cl-craft` at `cbe7a6bc5` ([source PR](https://github.com/copperleaftech/cl-system/pull/4631)).

| Source | Portable file | Choice |
| --- | --- | --- |
| `ds-craft/SKILL.md`, `cl-craft/SKILL.md` | `SKILL.md` | Keep build and the shared mode structure; route repo facts through a profile. |
| `ds-craft/references/verbs/build.md` | `references/verbs/build.md` | Keep build and triage. |
| Both sources' `references/verbs/{refine,report}.md` | Same paths | Use neutral targets and profile gates. |
| Both sources' `references/{schema,reviewer,writer-digest}.md` | Same paths | Keep report classes, coverage, and reviewer limits. |
| `ds-craft/references/packets/angular-craft.md`, `cl-craft/references/packets/angular.md` | `references/packets/angular.md` | Keep the shared probe IDs and neutral title. |
| Both sources' `references/packets/{performance,correctness,architecture}.md` | Same paths | Keep shared probes and neutral rule citations. |
| Both sources' `scripts/report-*.mjs` and specs | `scripts/report-*.mjs` and specs | Resolve root, targets, packages, packets, and fixtures without a repo layout. |
| None | `references/repo-profile.md` | Discover repository rules, gates, and targets per run. |
| `ds-craft/references/packets/{ds-contract,ds-consumer}.md`, `cl-craft/references/packets/cl-contract.md` | No portable packet | Published component contracts and catalog adoption belong to the repository skill. |

## Probe changes

Merged `craft-1.4` into `craft-5.2`, `craft-1.7` into `craft-1.1`, `craft-2.11` into `craft-2.7`, and `craft-5.5` into `craft-5.1`.

The table records the initial comparison of all 139 shared probe IDs, including citation-only
changes. Each reason names the port's substantive choice where applicable.

| ID | Sources | Reason |
| --- | --- | --- |
| `craft-1.1` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s role-based names wording over the source-specific alternative. |
| `craft-1.5` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s consistent state vocabulary wording over the source-specific alternative. |
| `craft-1.6` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s added literal-boolean argument rule and its named options. |
| `craft-1.8` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s abbreviations rule; routed its policy source through the profile. |
| `craft-1.10` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s type-suffix noise wording over the source-specific alternative. |
| `craft-1.11` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Class prefixes and selector examples now follow the profile. |
| `craft-2.1` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s unneeded DOM wrappers rule; routed its policy source through the profile. |
| `craft-2.2` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s readable derivations and effects rule; routed its policy source through the profile. |
| `craft-2.4` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s modern Angular APIs rule; routed its policy source through the profile. |
| `craft-2.6` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept TypeScript escape checks; removed a library-only assertion rule. |
| `craft-2.7` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s unused surface wording over the source-specific alternative. |
| `craft-2.9` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s subscription cleanup rule; routed its policy source through the profile. |
| `craft-2.10` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s duplicate branches wording over the source-specific alternative. |
| `craft-2.12` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s nesting depth wording over the source-specific alternative. |
| `craft-3.1` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s modifier scales wording over the source-specific alternative. |
| `craft-3.2` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s duplicate variant rules rule; routed its policy source through the profile. |
| `craft-3.3` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s child style overrides rule; routed its policy source through the profile. |
| `craft-3.4` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s CSS variable indirection wording over the source-specific alternative. |
| `craft-3.5` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s selector grouping wording over the source-specific alternative. |
| `craft-3.7` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Token source now follows the SCSS role. |
| `craft-3.8` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Typography tokens now follow the SCSS role. |
| `craft-3.10` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s style bindings wording over the source-specific alternative. |
| `craft-3.11` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s stylesheet sections wording over the source-specific alternative. |
| `craft-5.1` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s comment purpose rule; routed its policy source through the profile. |
| `craft-5.2` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s redundant comments wording over the source-specific alternative. |
| `craft-5.6` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s historical comments rule; routed its policy source through the profile. |
| `craft-5.7` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s TODO and work-item comments rule; routed its policy source through the profile. |
| `craft-5.10` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s doc comment contracts rule; routed its policy source through the profile. |
| `craft-6.4` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Test stack and browser project now follow the profile. |
| `craft-6.6` | `ds-craft/references/packets/angular-craft.md`; `cl-craft/references/packets/angular.md` | Kept cl-craft’s demo-only branches wording over the source-specific alternative. |
| `perf-1.4` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept cl-craft’s unrelated recomputation wording over the source-specific alternative. |
| `perf-1.5` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept cl-craft’s render callbacks rule; routed its policy source through the profile. |
| `perf-2.1` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept the OnPush and computed behavior; removed a DS-only gate pointer. |
| `perf-2.3` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Preserved the effect cascade rule; cited dependent signal state by role. |
| `perf-2.4` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept bounded-list behavior; replaced tenant data with growing collections. |
| `perf-2.7` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept the controlled-state sync exception; removed a DS-only policy pointer. |
| `perf-3.1` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept cl-craft’s per-instance hooks rule; routed its policy source through the profile. |
| `perf-5.1` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept cl-craft’s lazy boundaries rule; routed its policy source through the profile. |
| `perf-5.5` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Broad reads now refer to growing collections. |
| `perf-5.9` | `ds-craft/references/packets/performance.md`; `cl-craft/references/packets/performance.md` | Kept cl-craft’s navigation feedback wording over the source-specific alternative. |
| `correct-1.3` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Restored source null normalization; profile can override absence style. |
| `correct-1.5` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s unknown keys wording over the source-specific alternative. |
| `correct-2.1` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s failure and empty states rule; routed its policy source through the profile. |
| `correct-2.2` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s rejection handling rule; routed its policy source through the profile. |
| `correct-2.3` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s pending state cleanup rule; routed its policy source through the profile. |
| `correct-3.2` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s single-source state rule; routed its policy source through the profile. |
| `correct-3.4` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s refresh state wording over the source-specific alternative. |
| `correct-3.5` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Context keys replace domain-specific workspace and tenant examples. |
| `correct-3.6` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Async completion replaces agent-tool example. |
| `correct-3.9` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s dependent signal reset rule; routed its policy source through the profile. |
| `correct-5.1` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s API validation rule; routed its policy source through the profile. |
| `correct-5.2` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s response typing wording over the source-specific alternative. |
| `correct-5.3` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s option keys wording over the source-specific alternative. |
| `correct-5.4` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s navigation commands rule; routed its policy source through the profile. |
| `correct-6.1` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Control behavior uses the repo component library when present. |
| `correct-6.2` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s input snapshots rule; routed its policy source through the profile. |
| `correct-6.3` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s derived UI rule; routed its policy source through the profile. |
| `correct-6.5` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s mutation guards wording over the source-specific alternative. |
| `correct-6.6` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s pending cancellation rule; routed its policy source through the profile. |
| `correct-6.7` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s active-item validity rule; routed its policy source through the profile. |
| `correct-6.8` | `ds-craft/references/packets/correctness.md`; `cl-craft/references/packets/correctness.md` | Kept cl-craft’s portaled surfaces wording over the source-specific alternative. |
| `architecture-1.3` | `ds-craft/references/packets/architecture.md`; `cl-craft/references/packets/architecture.md` | Kept family placement and public type exports; removed DS-only tier paths. |
| `architecture-1.6` | `ds-craft/references/packets/architecture.md`; `cl-craft/references/packets/architecture.md` | Kept composition and focus rules; handed public contract checks to the repo skill. |
| `architecture-1.11` | `ds-craft/references/packets/architecture.md`; `cl-craft/references/packets/architecture.md` | Used cl-craft’s neutral template boundary test in place of a DS policy pointer. |

The remaining shared IDs have identical probe text in both sources and this fork.
Source-only contract and catalog IDs are listed below.

## Refresh

1. Read both source revisions and list probe IDs and script test cases.
2. Compare each shared probe by ID. Keep stronger Angular/TypeScript substance and move
   repository facts into the profile. Record dropped or changed IDs here.
3. Port script behavior and test cases to both neutral fixtures. Run `node --test personal/skills/mr-craft/scripts/*.spec.mjs`,
   check forbidden repository paths, and preview the personal installer offline.
4. Review the resulting text and script diff before updating the source revisions above.

## Source-only probe IDs omitted

These IDs belong to repository contract or catalog packets. Each is omitted from portable
craft; a repository skill remains responsible for the underlying rule.

### ds-craft: ds-contract (59)

| ID | Reason |
| --- | --- |
| `contract-1.1` | Repository-specific policy sweep contract. |
| `contract-1.2` | Repository-specific policy sweep contract. |
| `contract-1.3` | Repository-specific policy sweep contract. |
| `contract-1.4` | Repository-specific policy sweep contract. |
| `contract-1.5` | Repository-specific policy sweep contract. |
| `contract-1.6` | Repository-specific policy sweep contract. |
| `contract-1.7` | Repository-specific policy sweep contract. |
| `contract-1.8` | Repository-specific policy sweep contract. |
| `contract-1.9` | Repository-specific policy sweep contract. |
| `contract-1.10` | Repository-specific policy sweep contract. |
| `contract-1.11` | Repository-specific policy sweep contract. |
| `contract-1.12` | Repository-specific policy sweep contract. |
| `contract-1.13` | Repository-specific policy sweep contract. |
| `contract-1.14` | Repository-specific policy sweep contract. |
| `contract-1.15` | Repository-specific policy sweep contract. |
| `contract-1.16` | Repository-specific policy sweep contract. |
| `contract-1.17` | Repository-specific policy sweep contract. |
| `contract-1.18` | Repository-specific policy sweep contract. |
| `contract-1.19` | Repository-specific policy sweep contract. |
| `contract-1.20` | Repository-specific policy sweep contract. |
| `contract-1.21` | Repository-specific policy sweep contract. |
| `contract-2.1` | Repository-specific design settled contract. |
| `contract-2.2` | Repository-specific design settled contract. |
| `contract-2.3` | Repository-specific design settled contract. |
| `contract-2.4` | Repository-specific design settled contract. |
| `contract-2.5` | Repository-specific design settled contract. |
| `contract-2.6` | Repository-specific design settled contract. |
| `contract-3.1` | Repository-specific api committed (semver from here) contract. |
| `contract-3.2` | Repository-specific api committed (semver from here) contract. |
| `contract-3.3` | Repository-specific api committed (semver from here) contract. |
| `contract-3.4` | Repository-specific api committed (semver from here) contract. |
| `contract-3.5` | Repository-specific api committed (semver from here) contract. |
| `contract-3.7` | Repository-specific api committed (semver from here) contract. |
| `contract-3.8` | Repository-specific api committed (semver from here) contract. |
| `contract-3.9` | Repository-specific api committed (semver from here) contract. |
| `contract-3.10` | Repository-specific api committed (semver from here) contract. |
| `contract-3.11` | Repository-specific api committed (semver from here) contract. |
| `contract-4.1` | Repository-specific accessible contract. |
| `contract-4.2` | Repository-specific accessible contract. |
| `contract-4.3` | Repository-specific accessible contract. |
| `contract-4.4` | Repository-specific accessible contract. |
| `contract-4.5` | Repository-specific accessible contract. |
| `contract-4.6` | Repository-specific accessible contract. |
| `contract-4.7` | Repository-specific accessible contract. |
| `contract-4.8` | Repository-specific accessible contract. |
| `contract-5.1` | Repository-specific verified contract. |
| `contract-5.2` | Repository-specific verified contract. |
| `contract-5.3` | Repository-specific verified contract. |
| `contract-5.4` | Repository-specific verified contract. |
| `contract-6.1` | Repository-specific human-reviewed contract. |
| `contract-6.3` | Repository-specific human-reviewed contract. |
| `contract-7.1` | Repository-specific documented in the catalog's vocabulary contract. |
| `contract-7.2` | Repository-specific documented in the catalog's vocabulary contract. |
| `contract-7.3` | Repository-specific documented in the catalog's vocabulary contract. |
| `contract-7.4` | Repository-specific documented in the catalog's vocabulary contract. |
| `contract-7.5` | Repository-specific documented in the catalog's vocabulary contract. |
| `contract-7.6` | Repository-specific documented in the catalog's vocabulary contract. |
| `contract-7.7` | Repository-specific documented in the catalog's vocabulary contract. |
| `contract-8.1` | Repository-specific other material concern contract. |

### ds-craft: ds-consumer (35)

| ID | Reason |
| --- | --- |
| `consumer-1.1` | Catalog adoption is specific to the repository. |
| `consumer-1.3` | Catalog adoption is specific to the repository. |
| `consumer-1.4` | Catalog adoption is specific to the repository. |
| `consumer-1.5` | Catalog adoption is specific to the repository. |
| `consumer-1.6` | Catalog adoption is specific to the repository. |
| `consumer-1.7` | Catalog adoption is specific to the repository. |
| `consumer-2.1` | Catalog adoption is specific to the repository. |
| `consumer-2.2` | Catalog adoption is specific to the repository. |
| `consumer-2.3` | Catalog adoption is specific to the repository. |
| `consumer-2.4` | Catalog adoption is specific to the repository. |
| `consumer-2.5` | Catalog adoption is specific to the repository. |
| `consumer-2.7` | Catalog adoption is specific to the repository. |
| `consumer-3.1` | Catalog adoption is specific to the repository. |
| `consumer-3.2` | Catalog adoption is specific to the repository. |
| `consumer-3.3` | Catalog adoption is specific to the repository. |
| `consumer-3.4` | Catalog adoption is specific to the repository. |
| `consumer-3.5` | Catalog adoption is specific to the repository. |
| `consumer-4.1` | Catalog adoption is specific to the repository. |
| `consumer-4.2` | Catalog adoption is specific to the repository. |
| `consumer-4.3` | Catalog adoption is specific to the repository. |
| `consumer-4.4` | Catalog adoption is specific to the repository. |
| `consumer-4.5` | Catalog adoption is specific to the repository. |
| `consumer-4.6` | Catalog adoption is specific to the repository. |
| `consumer-4.7` | Catalog adoption is specific to the repository. |
| `consumer-5.1` | Catalog adoption is specific to the repository. |
| `consumer-5.2` | Catalog adoption is specific to the repository. |
| `consumer-5.3` | Catalog adoption is specific to the repository. |
| `consumer-5.4` | Catalog adoption is specific to the repository. |
| `consumer-5.5` | Catalog adoption is specific to the repository. |
| `consumer-6.1` | Catalog adoption is specific to the repository. |
| `consumer-6.2` | Catalog adoption is specific to the repository. |
| `consumer-6.3` | Catalog adoption is specific to the repository. |
| `consumer-6.4` | Catalog adoption is specific to the repository. |
| `consumer-6.5` | Catalog adoption is specific to the repository. |
| `consumer-7.1` | Catalog adoption is specific to the repository. |

### cl-craft: cl-contract (41)

| ID | Reason |
| --- | --- |
| `contract-1.1` | Repository-specific public api contract. |
| `contract-1.2` | Repository-specific public api contract. |
| `contract-1.3` | Repository-specific public api contract. |
| `contract-1.4` | Repository-specific public api contract. |
| `contract-1.5` | Repository-specific public api contract. |
| `contract-1.6` | Repository-specific public api contract. |
| `contract-1.7` | Repository-specific public api contract. |
| `contract-2.1` | Repository-specific api shape contract. |
| `contract-2.2` | Repository-specific api shape contract. |
| `contract-2.3` | Repository-specific api shape contract. |
| `contract-2.4` | Repository-specific api shape contract. |
| `contract-2.5` | Repository-specific api shape contract. |
| `contract-3.1` | Repository-specific tracking contract. |
| `contract-3.2` | Repository-specific tracking contract. |
| `contract-3.3` | Repository-specific tracking contract. |
| `contract-4.1` | Repository-specific accessibility contract. |
| `contract-4.2` | Repository-specific accessibility contract. |
| `contract-4.3` | Repository-specific accessibility contract. |
| `contract-4.4` | Repository-specific accessibility contract. |
| `contract-4.5` | Repository-specific accessibility contract. |
| `contract-4.6` | Repository-specific accessibility contract. |
| `contract-4.7` | Repository-specific accessibility contract. |
| `contract-4.8` | Repository-specific accessibility contract. |
| `contract-5.1` | Repository-specific internationalization contract. |
| `contract-5.2` | Repository-specific internationalization contract. |
| `contract-6.1` | Repository-specific verified contract. |
| `contract-6.2` | Repository-specific verified contract. |
| `contract-6.3` | Repository-specific verified contract. |
| `contract-6.4` | Repository-specific verified contract. |
| `contract-7.1` | Repository-specific docs and examples contract. |
| `contract-7.2` | Repository-specific docs and examples contract. |
| `contract-7.3` | Repository-specific docs and examples contract. |
| `contract-7.4` | Repository-specific docs and examples contract. |
| `contract-7.5` | Repository-specific docs and examples contract. |
| `contract-7.6` | Repository-specific docs and examples contract. |
| `contract-7.7` | Repository-specific docs and examples contract. |
| `contract-8.1` | Repository-specific release and review record contract. |
| `contract-8.2` | Repository-specific release and review record contract. |
| `contract-8.3` | Repository-specific release and review record contract. |
| `contract-8.4` | Repository-specific release and review record contract. |
| `contract-9.1` | Repository-specific other material concern contract. |
