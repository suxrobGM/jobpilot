---
name: search
description: Search a chosen job board via Playwright, rank results by fit against the user's resume, and save them to the campaign so the user can review.
argument-hint: "<job_title_keywords_location> (--board <domain> | --anywhere) [--max-jobs N] [--campaign <campaign-id>]"
---

# Job Search

Search a single board (picked by the user when launching the campaign), or the open web with
`--anywhere`, and rank results by qualification fit against the resume.

## Setup

1. Follow `../_shared/setup.md`.
2. Parse and strip the flags; the rest is the free-text query.
   - `--board <domain>` (e.g. `--board linkedin.com`) or `--anywhere` - exactly one is required.
     `--anywhere` searches the open web instead of a board: see **Anywhere on the web**.
   - `--max-jobs <N>` - optional cap on results to rank. Absent = unlimited (rank until the board is
     exhausted).
   - `--campaign <campaign-id>` - campaign to save results to (Phase 5). The web UI passes it; if
     absent, match the latest `source:"search"`, `status:"in_progress"` campaign on the query, else
     create one (a `source:"search"` create requires `config.resumeId` - default to the profile's
     `primaryResumeId`).
3. Resolve the board:

   ```bash
   jobpilot-api GET /api/job-boards
   ```

   Pick the entry whose `domain` is `<domain>`. If none matches, abort with: "Board `<domain>` is
   not configured. Add it on /boards or run again with a different `--board`." When a `--campaign`
   id was given, first command it to `failed` with `POST /api/campaigns/<id>/status
   {"status":"failed"}`.

## Anywhere on the web

With `--anywhere`, skip step 3 of Setup and Phases 2-5. Delegate one `job-researcher` run with
`{runId:null, campaignId:<campaign-id>, goals:<query>, resumeId:<config.resumeId>, minScore:0,
approveAtOrAbove:null, preferCapExempt:user.preferCapExempt,
requiresSponsorship:user.requiresSponsorship, boards:<every domain from GET /api/job-boards>,
newJobsTarget:<--max-jobs, else 20>}`. Without subagent support, follow
`$JOBPILOT_SKILLS_ROOT/../agents/job-researcher.md` inline. The agent saves its own rows as
`pending`. Then close the campaign as in Phase 5 and hand off (Phase 6) from its output: list
`best`, and add the `capExempt` count and any `boardsSuggested` under the table.

## Phase 1: Parse Query

Extract title/role, keywords, location, other preferences (e.g. "no startups", "FAANG only",
salary). If vague, ask before searching.

## Phase 2: Search the Board

1. `browser_navigate` to the resolved board's `searchUrl`.
2. Follow `../_shared/auth.md` to log in proactively.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `../_shared/browser-tips.md`) and
   read `{ title, company, location, url, postedAt }` per row. While under `--max-jobs` (or always,
   when it's absent/unlimited), scroll/paginate per **Pagination & infinite scroll** in
   `../_shared/browser-tips.md` until the cap is met or results run dry.
5. Take the first `--max-jobs` results (or all of them when unlimited); if fewer after paginating,
   take what's there. Per row:
   - **Listing preview suffices** (the normal case) → rank from the row; no per-job navigation.
   - **A brief description is needed for the ranked table and the preview lacks one** → delegate
     that row to the `job-scorer` subagent with `mode:"score"` and `minMatchScore:0` (so nothing is
     auto-skipped - search keeps every result for review). It opens the posting, scores, and saves
     the campaign job in isolated context. Such rows are already saved - exclude them from the Phase 5
     bulk save.

## Phase 3: Exclude Previously Applied

Run the applied-check (`../_shared/campaign-flow.md`) per result. If `.applied`, tag with
"Previously Applied" (note `.match.kind`). In Phase 5, create these rows as `pending`, then
record `skipped` through `/jobs/<key>/result`; do not offer them for apply.

## Phase 4: Fit Review

Score each non-applied result server-side, like every other campaign skill. Build the brief
(`../_shared/job-brief.md`) and write `{"brief": <brief>, "minScore": 0, "resumeId":
"<config.resumeId>"}` to `$JOBPILOT_TEMP/fit.json` (drop `resumeId` when the campaign has none; the
server uses the primary):

```bash
jobpilot-api POST /api/fit-scores --data @"$JOBPILOT_TEMP/fit.json"
```

Use `.score` when `.verdict` is `trust`; on `deliberate`, adjust it from
`strongMatches`/`partialMatches`/`gaps`. `minScore: 0` because search keeps every result for the
user to review.

## Phase 5: Save Results to the Campaign

Save every result as a campaign job on `<campaign-id>` so it appears on the campaigns detail page. **Don't
offer apply/search-again commands** - the user applies from there. Use a stable, shell-safe `key`
per result (slug of `company-title` + rank, no spaces).

Carry the `brief` you scored from (`../_shared/job-brief.md`). Per result, write `{key, title,
company, location, url, board:"<domain>", matchScore, matchReason:"<one-line verdict>",
status:"pending", brief}` (`brief` as a JSON object) to `$JOBPILOT_TEMP/job-<key>.json`, then:

```bash
jobpilot-api POST /api/campaigns/<campaign-id>/jobs --data @"$JOBPILOT_TEMP/job-<key>.json"
```

Previously-applied results (Phase 3) → create as `pending`, then POST `/jobs/<key>/result` with
`{outcome:"skipped",skipReason:"Already applied (<kind>)"}`. Then close the campaign:

```bash
jobpilot-api POST /api/campaigns/<campaign-id>/status --data '{"status":"completed"}'
```

## Phase 6: Hand Off

Print a compact ranked table, then link to the campaign - nothing else:

```
## Saved <N> jobs · "[query]" - review and apply at $JOBPILOT_WEB/pipeline?campaign=<campaign-id>

| # | Score | Title | Company | Location |
|---|-------|-------|---------|----------|
```

## Rules

The shared campaign rules (`../_shared/campaign-flow.md`) apply throughout. On top of them:

1. **Exactly one board per campaign** - the skill targets only the `--board` given, or, with
   `--anywhere`, no board at all.
2. **Handle rate limiting** - if blocked, note it and continue.
3. **Deduplicate** within the board.

Read `../_shared/browser-tips.md` for large pages, popups, and browser best practices.
