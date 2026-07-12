# Green CI

Tier 0 — Fixes · Status: **done**

## What

~~`bun run ci` fails today: 161 errors~~ **The premise was wrong: CI was already green.**

`biome ci --error-on-warnings` exits 0 on a clean LF checkout, and every recent push to `main`
passed. The 161 errors were a Windows-local artifact: `core.autocrlf=true` checked the worktree out
as CRLF, Biome formats to LF, and no `.gitattributes` normalized it. The index was already 100% LF
(735/735 text files), so Linux CI never saw a CRLF. The real bug was that `bun run ci` was unusable
locally.

Only 8 diagnostics were real, and all 8 were **infos** — advisory by design.

## Done when

`bun run ci` exits 0 and stays green in the PR gate. ✅

## Notes

- 2026-07-12 — Done. `.gitattributes` (`* text=auto eol=lf`) pins the worktree to LF on every
  platform, so local `bun run ci` now matches CI. Cleared the 8 advisory infos: 7 `return <></>`
  guard clauses became `return null` (then typed `ReactNode`, per the existing `SkillsList`
  precedent) and 1 redundant switch case. `biome check` is now fully silent.
- Never `biome check --write --unsafe` — the `noNonNullAssertion` fix rewrites `cookie[KEY]!.set(…)`
  to `?.set(…)` and silently drops auth cookie writes.
