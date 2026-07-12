# Scratch-file discipline

Tier 0 — Fixes · Status: **done**

## What

A worker wrote raw browser snapshots to the repo root (`job-header.md`, `results-p2.md`) instead of
`$JOBPILOT_WORKSPACE_ROOT/.temp`.

**Correction:** those two files no longer existed and were never committed (`git log --all` is empty
for both). The work was **prevention**, not deletion.

The rule *did* exist — but only once, in `plugin/shared/setup.md`, and only `form-filling.md` linked
to it. Neither worker agent mentioned `.temp` at all. That is exactly what a stated-but-unenforced
rule looks like: `.temp/` holds 38 correctly-placed files from the same runs that leaked two to the
root.

## Done when

Rule is explicit in setup.md ✅; `.gitignore` covers stray snapshot dumps ✅; the two stray files are
removed (already gone) ✅.

## Notes

- 2026-07-12 — Done.
- `setup.md`: guard `$JOBPILOT_WORKSPACE_ROOT` before use — it is **empty outside the terminal host**,
  so `"$JOBPILOT_WORKSPACE_ROOT/.temp"` would resolve to `/.temp`. Also requires key-prefixed
  filenames: bare `header.md` / `base.json` collide across parallel jobs.
- Both worker agents now state the rule in their `## Rules` list, where the writing actually happens.
- `.gitignore` now ignores root strays by **location**, not by guessed filename. The old
  `snapshot-*.md` was shape-based and duly missed both real strays, and `.tsv` (10 produced by that
  run) wasn't ignored at all. Verified: the strays are caught and no tracked file is hidden.
- Fixed the stale pointer in the `.gitignore` comment (`plugin/skills/shared/setup.md` → no `skills/`
  segment).
