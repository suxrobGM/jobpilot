# Token efficiency grab bag

Tier 3 - Intelligence & Efficiency · Status: **todo**

## What

Three independent wins, each measurable via [t1-step-telemetry.md](t1-step-telemetry.md):

- **Per-board `browser_evaluate` extractors** - structured JSON out of the page instead of a11y
  snapshots; an order of magnitude cheaper for scoring. Pairs with
  [t3-ats-playbooks.md](t3-ats-playbooks.md).
- **Model routing per worker mode** - workers are pinned to `sonnet`; use a cheap model for
  replay/pagination/dedupe, the strong model for eligibility edge cases + essay questions.
- **Campaign-level tailoring memoization** - JDs within one campaign cluster tightly; reuse the
  variant decision across similar digests instead of re-invoking `tailor-resume` per job.

## Done when

Token-per-applied-job drops against the telemetry baseline; no quality regression in the eval
lab.

## Notes

- 2026-08-30: measured against a real overnight run - 8h, 25 applications, ~5% of a weekly limit.
  Two costs dominated that this item never named, both now fixed:
  - `plugin/skills/pilot/SKILL.md` was 3689 words covering all 19 agenda kinds, and the host
    `/clear`s before every injection, so each cycle re-read all 19 to run one. Split into a
    ~1200-word core plus `kinds/<kind>.md`, read only for the kind claimed.
  - `cover-letter` re-read the source resume PDF (already loaded as structured data by
    `_shared/setup.md`) and pulled five prior letters in full, per job with a letter field.
- The three items above still stand, but rank them off `GET /api/pilot/stats/cost` rather than
  intuition. Model routing is the cheapest to try: both workers are pinned `model: sonnet` in
  `plugin/agents/*.md`.
- One more candidate, not listed above: `tailor-resume` step 4 scores up to 15 full variant
  documents in-model per apply. The scoring table is deterministic, so the API could compute it the
  way `resume/structure.ts` already does and hand back a ranked shortlist.
