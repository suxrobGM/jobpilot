---
name: cleanup
description: Review and clean up the given file(s)/folder(s)/module(s): rate organization, find dead code, duplication, prop drilling/coupling, over-engineering, deep nesting, and structural issues, then produce and execute a phased refactor plan. Trigger on "clean up X", "review and refactor X", "rate the code in X", "code quality review of X".
---

# Code Cleanup

Systematic review-then-refactor of a target path (file, folder, module, or feature). Project-agnostic: every judgment is calibrated against the host project's own conventions, not generic taste. The argument is the target path(s); if none given, ask.

## Process

### 1. Inventory

List the target's files with line counts (largest first). Read the project's conventions FIRST - CLAUDE.md, rules files, lint/formatter config - so findings are judged against this project's rules. Note the size ceiling, naming scheme, comment policy, and framework idioms (e.g. an auto-memoizing compiler makes manual memoization a finding, not a virtue).

### 2. Map consumers

Find every importer outside the target (grep the target's path/package name). Record which symbols cross the boundary - this defines the public surface that moves/renames must preserve. Flag anything inside the target that belongs to a different feature (misfiled code: check who actually consumes it and what data it uses). Also map the reverse direction: what other modules the target reaches into.

Then enumerate the target's **adjacent plumbing** - the out-of-tree files that wire it into the app: routes/pages that render it, providers, shared libs it owns or leans on, its query functions/keys/data hooks, locale files, and feature-map/docs entries. These are part of the review scope (steps 3–6), not just context: dead code hides there (query functions bypassed by direct calls, orphaned keys), and moves inside the target often require updating them.

### 3. Hunt - fifteen categories, each finding cited as file:line

- **Dead code** - exports with zero importers, props never used or always passed the same constant, state set but never read, unreachable branches, orphaned i18n keys/assets, dead barrel exports, dead style properties (transitions on properties that never change, overrides duplicating defaults), commented-out code.
- **Duplication** - near-identical components/functions, repeated JSX/style blocks, repeated data-massaging that reimplements an existing util (check the project's utils first), copy-pasted loading/empty/error shells, repeated inline constants (thresholds, colors, key arrays).
- **Coupling & drilling** - props threaded through layers unchanged, pass-through components, N-prop bundles that should be one object, the same object fetched/derived in many places (context/provider candidate), cross-feature reach-ins into another module's internals, circular imports.
- **Over-engineering** - wrappers with one consumer and no behavior, generics with one instantiation, config indirection with a single reader, pointless configurability, options nobody passes. Record what was evaluated and deliberately KEPT so the next pass doesn't re-litigate.
- **Under-abstraction** - the inverse: files with too many responsibilities, the same concept rendered twice, missing extraction where 3+ siblings repeat a pattern, god-files past the project's size ceiling.
- **Structure & naming** - loose root files, folder names that don't match contents, misfiled code, redundant filename prefixes (the directory is the namespace), inconsistent conventions within a folder, trivial barrels, public surface exposing internals.
- **Type quality** - `any`/`unknown` casts, non-null assertions where narrowing works, inline anonymous types in signatures, loose `Record<string, …>` where a derived/generated type exists, hand-written types duplicating inferred/generated ones, duplicated type definitions.
- **Data flow & performance** - N+1 requests (per-item effects/fetches where a batch exists), the same data fetched by multiple siblings, effect-into-state where derivation works, render-time work that belongs in the data layer, unbounded lists/maps without eviction or pagination, heavy imports for one function.
- **Error handling & resilience** - swallowed errors (`.catch(() => fallback)` masking failure as a valid state), missing error/loading/empty states, inconsistent error handling across siblings, missing cleanup of timers/subscriptions/observers, race conditions from stale closures or unawaited sequencing.
- **Consistency** - two patterns solving the same problem within the target (mixed dialog patterns, mixed data-fetch idioms, mixed styling, mixed empty states): identify the project-dominant idiom and converge on it.
- **i18n & accessibility** - hardcoded user-facing strings, keys missing in some locales, hand-rolled date/number formatting where locale-aware helpers exist, missing alt/aria on interactive or image elements.
- **Convention violations** - breaches of the project's own written rules (comments, naming, styling, framework idioms), judged strictly against the docs read in step 1.
- **Deep nesting** - files housing multiple internal components that outgrew co-location (split when the file passes the size ceiling OR a subcomponent gains a second consumer - otherwise co-location is good; don't split reflexively), render-closures/`renderX()` helpers that should be components, JSX nested 4+ layout-wrapper levels deep, component trees where each layer adds only markup.
- **Adjacent plumbing** - run the dead-code, duplication, and consistency lenses over the plumbing enumerated in step 2: query functions with zero importers (callers went direct), unused query keys, near-identical route files differing in a handful of values, presentation mappings re-hardcoded per page instead of using the target's own helpers, locale keys orphaned by UI changes, stale feature-map/docs entries.
- **Large & plumbed files** - rank the N largest files (target AND plumbing) and read them line-by-line even when under the size ceiling: size correlates with responsibility accumulation. Separately, inspect pure-plumbing layers (pass-through wrappers, thin files around one call, pages that only forward data) and ask whether each layer earns its existence.

### 4. Rate

Score each subfolder /10 with a one-line justification. This makes the review scannable and directs the refactor effort to the lowest scores.

### 5. Verify uncertain findings

Grep every "unused" claim before deleting. A visual double-render may be intentional design (e.g. current-state vs next-state) - check semantics, not just similarity. Mark anything unproven UNCERTAIN and resolve it before the phase that touches it.

### 6. Plan in phases - each independently buildable and committable

0. **Delete dead code** (first, so later phases touch less).
1. **Pure moves/renames** via `git mv` - zero logic change, so history follows and review is trivial. Never mix moves with logic edits in one commit.
2. **Structural changes** - contexts/providers, API reshaping, drilling removal.
3. **Dedupe extractions** - shared shells, hooks, helpers.
4. **Smells & polish** - types, i18n, magic numbers, error handling.

### 7. Verify

After each phase, run the project's own commands (typecheck / lint / tests - read them from the project docs, don't guess). After all phases, manually exercise the affected screens or flows end-to-end.

## Scale

- Target ≤ ~10 files: do steps 1–3 inline.
- Larger: fan out Explore agents with grouped categories (e.g. one for dead code + over-engineering + type quality, one for duplication + consistency, one for coupling + data flow + deep nesting) - one agent per category over-fragments the reading. Map consumers in a separate agent.
- Implementation can be delegated phase-by-phase to subagents; the orchestrator reviews each diff, runs verification, and commits before dispatching the next phase.

## Ask the user before

- Introducing new architectural pieces (providers, contexts, new shared layers).
- Deleting anything still marked UNCERTAIN.
- Renaming/moving files consumed outside the target.
- Any fix that changes user-visible behavior (error rendering, empty states, labels).
