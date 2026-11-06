---
name: auto-apply
description: Search a job board and autonomously apply to matching jobs one at a time, until paused, exhausted, or the max-applications cap is hit.
argument-hint: "<query> (--board <domain> | --anywhere) [--min-score N] [--max-apps N] | resume | retry-failed"
---

# Auto-apply - Search + Apply On Demand

Keep the chosen board open in tab 1; for each result that qualifies, delegate the application to the
`job-applier` subagent (it works in its own tab and returns a compact result), then move to the next
job. **No batch pre-discovery and no per-job approval - launching the run is the
confirmation.** Pause only for 2FA / payment. **A CAPTCHA is not a pause** - attempt the
`solve-captcha` skill; if unsolved, skip the job (never pause) and the user finishes it later via
the `apply` skill. Live view at `$JOBPILOT_WEB/pipeline?feed=<feed-id>`.

## Setup

Follow `../_shared/setup.md`. Shared feed mechanics (applied-check, result writes, worker
input, rules) live in `../_shared/feed-flow.md`.

- `minMatchScore` = `--min-score`, else `GET /api/pilot` → `config.minScore` (default 60).
- Stop after `--max-apps` successful applies; without it, run until the board is exhausted.

Inline argument overrides take precedence. Exactly one of `--board <domain>` or `--anywhere` is
**required** unless the argument is `resume` or `retry-failed`. `--anywhere` searches
the open web instead of a board: see **Anywhere on the web**.

### Modes

Every mode works on the user's manual feed (Phase 0).

- `"resume"` → apply to the feed's `approved` rows, best first, with the 2.3-2.4 loop.
- `"retry-failed"` → for every retryable `failed` row of the feed, POST its `/retry` command with
  the current `retryNotes`, then apply to those rows with the 2.3-2.4 loop.
- Otherwise → search query → Phase 1.

To recover wrongly-`skipped` jobs, use the dedicated `rescan-skipped` skill (it re-scores and
promotes to `approved`; apply them afterward).

## Phase 0: The Manual Feed

Jobs from runs the user starts go to their one manual feed; read `.id` as `FEED_ID`:

```bash
jobpilot-api POST /api/feeds --data '{"kind":"manual"}'
```

`RESUME_ID` is `user.primaryResumeId`. Surface the live view: `$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`.

## Anywhere on the web

With `--anywhere`, research first, then apply; Phases 1 and 2 below are for a board.

1. **Research.** Delegate one `job-researcher` run with `{runId:null, feedId:$FEED_ID,
   goals:<query>, resumeId:$RESUME_ID, minScore:$MIN_SCORE, approveAtOrAbove:$MIN_SCORE,
   preferCapExempt:config.preferCapExempt, requiresSponsorship:user.requiresSponsorship,
   boards:<every domain from GET /api/job-boards>, newJobsTarget:20}`. Without subagent support,
   follow `$JOBPILOT_SKILLS_ROOT/../agents/job-researcher.md` inline. It saves rows at or above
   `$MIN_SCORE` as `approved` and skips the rest.
2. **Apply.** Run the 2.3-2.4 loop over the `approved` rows this research added, best first, with `MAX_APPS` = `--max-apps`. With `config.preferCapExempt`, a row with
   `capExemptBasis` ranks as if it scored 10 higher. Then Phase 3 below.

## Phase 1: Open the Board (tab 1)

### 1.1 Parse Query

Extract title/role, keywords, location, preferences. If vague, ask before searching.

### 1.2 Search the Chosen Board

Resolve the board:

```bash
jobpilot-api GET /api/job-boards
```

Pick the row whose `.domain` equals `<domain>`. If none matches, tell the user the board isn't
configured and stop.

1. `browser_navigate` to `searchUrl` (this is **tab 1** - keep it open for the whole run).
2. Follow `../_shared/auth.md` - logs in, and **registers a new account when none exists, without
   asking**.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `../_shared/browser-tips.md`) to read
   `{ title, company, location, url }` per row. This is one viewport - scroll/paginate
   per **Pagination & infinite scroll** in `../_shared/browser-tips.md` as the loop drains rows
   (see **Stop Conditions**); never treat the first batch as all jobs.

## Phase 2: Apply Loop (on demand)

Walk the tab-1 results top to bottom; at the last loaded row, scroll/page for more (per **Pagination
& infinite scroll** in `../_shared/browser-tips.md`) before concluding. For each result:

### 2.1 Pre-filter (no tab)

Dedupe in-board by normalized title+company, then run the applied-check
(`../_shared/feed-flow.md`). If `.applied`, record the default already-applied skip and
move on - **don't open a tab.**

### 2.2 Score

If the listing row lacks enough detail, read it from the tab-1 snapshot (don't navigate away). Build
the brief (`../_shared/job-brief.md`), then score server-side. Write `$JOBPILOT_TEMP/fit.json` as
`{"brief": <brief object>, "minScore": <MIN_SCORE>, "resumeId": "<RESUME_ID>"}` (drop `resumeId`
when there is none):

```bash
jobpilot-api POST /api/fit-scores --data @"$JOBPILOT_TEMP/fit.json"
```

Read `.score` as `SCORE` and `.verdict` as `FIT_VERDICT`, then branch (eligibility per
`../_shared/eligibility.md` - a thin/generic row is **not** a skip):

- **Confident** - `FIT_VERDICT == "trust"` → use the score directly.
- **Uncertain** - `FIT_VERDICT == "deliberate"` → rescore yourself from
  `strongMatches`/`partialMatches`/`gaps`.
- **Needs the full posting** → delegate the row to `job-scorer` `mode:"score"`
  (`{feedId:$FEED_ID, jobKey:<key>, url, resumeId:$RESUME_ID, minMatchScore:$MIN_SCORE}`)
  instead of opening the posting in this conversation. The worker creates every row non-terminal and
  sends ineligible outcomes to `/result`; eligible rows remain `pending`. PATCH an eligible row to
  `applying`, then go straight to apply (2.3):

```bash
jobpilot-api PATCH /api/feeds/$FEED_ID/jobs/<key> --data '{"status":"applying"}'
```

With a usable score from the listing/tab-1 snapshot alone:

- **Below `minMatchScore` after a fair read** → create as `pending`, POST `/result` with
  `outcome:"skipped"`, `skipReason:"Below minimum match score ($SCORE < $MIN_SCORE)"`, and move on
  (no tab).
- **Qualifies** → add it as `applying` and apply (2.3). Write `$JOBPILOT_TEMP/job.json`:

```json
{
  "key": "<stable-id>",
  "title": "<title>",
  "company": "<company>",
  "location": "<location>",
  "url": "<url>",
  "board": "<board>",
  "matchScore": <0-100>,
  "matchReason": "<one line>",
  "status": "applying",
  "brief": "<brief, stringified>",
  "description": "<posting text, when read>"
}
```

```bash
jobpilot-api POST /api/feeds/$FEED_ID/jobs --data @"$JOBPILOT_TEMP/job.json"
```

### 2.3 Apply (delegate to `job-applier`)

Hand the job to the `job-applier` subagent and wait for its compact result. It opens its own tab and
runs auth, CAPTCHA, tailoring, form-fill, and submit in isolated context, so the form/posting
snapshots never enter this conversation. **One worker at a time** - the browser is shared; never
delegate the next job until this one returns.

Delegate with the `job-applier` input from `../_shared/feed-flow.md`, passing the `brief`
built in 2.2 and `preSubmitReview: false`. It returns one of `applied` / `failed` / `skipped` /
`needs_user` - handle in 2.4.

### 2.4 Record + Continue

The worker already closed its apply tab(s); re-select tab 0. Map its `outcome` to a terminal
`/result` write and route `needs_user` per `../_shared/feed-flow.md`, with these
loop specifics:

- `salary` → re-delegate 2.3 with `salaryExpectation` set.
- `verification` → tell the user what's needed (e.g. LinkedIn 2FA) and exit the loop (the worker
  left its tab open); `resume` picks the run back up.
- `payment` → record the failure and continue with the next result.

Pace 3-5s before the next result.

### 2.5 Stop Conditions

The loop ends **only** on one of these:

1. `--max-apps` set and this run has that many `applied` results → end.
2. Board exhausted - per **Pagination & infinite scroll** in `../_shared/browser-tips.md` (2
   consecutive scrolls with no new rows). First batch done ≠ exhausted. Without `--max-apps`,
   paginate until genuinely dry.

## Phase 3: Summary

Print a summary table, link to `$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`, and suggest
`retry-failed`, the `rescan-skipped` skill to recover dropped jobs, or a new search.

## Rules

The shared feed rules (`../_shared/feed-flow.md`) apply throughout. On top of them:

1. **Autonomous after launch.** No per-job or batch confirmation; the UI launch is the approval.
2. **Board stays in tab 1.** Each application runs in the `job-applier`'s own tab, which it closes
   before returning.
3. **Missing resume file** → stop and ask the user to re-upload it.
