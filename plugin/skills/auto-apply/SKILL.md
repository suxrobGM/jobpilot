---
name: auto-apply
description: Search a job board and autonomously apply to matching jobs one at a time, until paused, exhausted, or the max-applications cap is hit.
argument-hint: "<query> (--board <domain> | --anywhere) [--campaign <campaign-id>] [--min-score N] [--max-apps N] | resume | retry-failed <campaign-id>"
---

# Auto-apply - Search + Apply On Demand

Keep the chosen board open in tab 1; for each result that qualifies, delegate the application to the
`job-applier` subagent (it works in its own tab and returns a compact result), then move to the next
job. **No batch pre-discovery and no per-job approval - launching the campaign is the
confirmation.** Pause only for 2FA / payment. **A CAPTCHA is not a pause** - attempt the
`solve-captcha` skill; if unsolved, skip the job (never pause) and the user finishes it later via
the `apply` skill. Live view at `$JOBPILOT_WEB/pipeline?campaign=<campaign-id>`.

## Setup

Follow `../_shared/setup.md`. Shared campaign mechanics (applied-check, result writes, worker
input, rules) live in `../_shared/campaign-flow.md`. Read `autoApply` (defaults applied per field):

| Setting                      | Default            | Notes                                                                                     |
| ---------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `minMatchScore`              | 60                 | Qualification threshold (0-100). Inline `--min-score` overrides.                          |
| `maxApplicationsPerCampaign` | `null` (unlimited) | Stop after this many successful applies. Inline `--max-apps` overrides; omit → unlimited. |
| `defaultStartDate`           | `"2 weeks notice"` | Default start-date answer.                                                                |

Inline argument overrides take precedence. Exactly one of `--board <domain>` or `--anywhere` is
**required** unless the argument is `resume` or `retry-failed <campaign-id>`. `--anywhere` searches
the open web instead of a board: see **Anywhere on the web**.

### Campaign Modes

- `"resume"` → list incomplete campaigns (`GET /api/campaigns?status=in_progress`), ask which to
  resume, replay the apply loop on remaining `applying`/`approved`/`pending` jobs.
- `"retry-failed <campaign-id>"` → fetch the campaign; for every retryable `failed` job, POST its
  `/retry` command with the current `retryNotes`, then replay the apply loop on those approved rows.
- Otherwise → search query → Phase 0.

To recover wrongly-`skipped` jobs, use the dedicated `rescan-skipped` skill (it re-scores and
promotes to `approved`; apply them afterward).

## Phase 0: Resolve the Campaign

**`--campaign <id>` passed**: use it as `CAMPAIGN_ID` and skip the checks below.

**No `--campaign`** (manual run): look for an unfinished campaign first.

```bash
jobpilot-api GET /api/campaigns --query status=in_progress --query source=auto_apply
jobpilot-api GET /api/campaigns --query status=paused --query source=auto_apply
```

A match in `.items` → ask **"Found an incomplete campaign from `<startedAt>` (status: `<status>`).
Resume or start fresh?"** Resume → run the `resume-campaign` skill with that `campaignId`. Otherwise
create one; `resumeId` defaults to `user.primaryResumeId`, and leave `maxApplications` out for
unlimited:

```bash
jobpilot-api POST /api/campaigns --data '{"query":"<query>","source":"auto_apply","board":"<domain>","config":{"resumeId":"<RESUME_ID>","minScore":<n>}}'
```

With `--anywhere`, send no `board`.

Read `.id` as `CAMPAIGN_ID`.

Either way, read the campaign's `config.resumeId` as `RESUME_ID` (`GET /api/campaigns/$CAMPAIGN_ID`;
absent → the primary) and surface the live view: `$JOBPILOT_WEB/pipeline?campaign=<CAMPAIGN_ID>`.

## Anywhere on the web

With `--anywhere`, research first, then apply; Phases 1 and 2 below are for a board.

1. **Research.** Delegate one `job-researcher` run with `{runId:null, campaignId:$CAMPAIGN_ID,
   goals:<query>, resumeId:$RESUME_ID, minScore:$MIN_SCORE, approveAtOrAbove:$MIN_SCORE,
   preferCapExempt:user.preferCapExempt, requiresSponsorship:user.requiresSponsorship,
   boards:<every domain from GET /api/job-boards>, newJobsTarget:20}`. Without subagent support,
   follow `$JOBPILOT_SKILLS_ROOT/../agents/job-researcher.md` inline. It saves rows at or above
   `$MIN_SCORE` as `approved` and skips the rest.
2. **Apply.** Run the `resume-campaign` skill's Phase 2 replay over the campaign's `approved` rows,
   best first, with `MAX_APPS` = `--max-apps`. With `user.preferCapExempt`, a row with
   `capExemptBasis` ranks as if it scored 10 higher. Then Phase 3 below.

## Phase 1: Open the Board (tab 1)

### 1.1 Parse Query

Extract title/role, keywords, location, preferences. If vague, ask before searching.

### 1.2 Search the Chosen Board

Resolve the board:

```bash
jobpilot-api GET /api/job-boards
```

Pick the row whose `.domain` equals `<domain>`. If none matches, command the campaign to `failed`
with `POST /api/campaigns/$CAMPAIGN_ID/status {"status":"failed"}` and stop.

1. `browser_navigate` to `searchUrl` (this is **tab 1** - keep it open for the whole campaign).
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
(`../_shared/campaign-flow.md`). If `.applied`, record the default already-applied skip and
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
  (`{campaignId:$CAMPAIGN_ID, jobKey:<key>, url, resumeId:$RESUME_ID, minMatchScore:$MIN_SCORE}`)
  instead of opening the posting in this conversation. The worker creates every row non-terminal and
  sends ineligible outcomes to `/result`; eligible rows remain `pending`. PATCH an eligible row to
  `applying`, then go straight to apply (2.3):

```bash
jobpilot-api PATCH /api/campaigns/$CAMPAIGN_ID/jobs/<key> --data '{"status":"applying"}'
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
jobpilot-api POST /api/campaigns/$CAMPAIGN_ID/jobs --data @"$JOBPILOT_TEMP/job.json"
```

### 2.3 Apply (delegate to `job-applier`)

Hand the job to the `job-applier` subagent and wait for its compact result. It opens its own tab and
runs auth, CAPTCHA, tailoring, form-fill, and submit in isolated context, so the form/posting
snapshots never enter this conversation. **One worker at a time** - the browser is shared; never
delegate the next job until this one returns.

Delegate with the `job-applier` input from `../_shared/campaign-flow.md`, passing the `brief`
built in 2.2 and `preSubmitReview: false`. It returns one of `applied` / `failed` / `skipped` /
`needs_user` - handle in 2.4.

### 2.4 Record + Continue

The worker already closed its apply tab(s); re-select tab 0. Map its `outcome` to a terminal
`/result` write and route `needs_user` per `../_shared/campaign-flow.md`, with these
campaign-loop specifics:

- `salary` → re-delegate 2.3 with `salaryExpectation` set.
- `verification` → command the campaign to `paused` through `/status` with
  `{"status":"paused","actor":"agent","reason":"<what's needed, e.g. LinkedIn 2FA>"}`, tell the
  user what's needed, and exit the loop (the worker left its tab open).
- `payment` → record the failure and continue with the next result.

Pace 3-5s before the next result.

### 2.5 Stop Conditions

The loop ends **only** on one of these. Before picking the next result, refetch the campaign (`GET
/api/campaigns/<CAMPAIGN_ID>`):

1. `status === "paused"` → POST `/result` `outcome:"skipped"`, `skipReason:"Campaign paused by
   user"` for any in-flight `applying` job, exit.
2. `config.maxApplications` set AND `summary.applied >= config.maxApplications` → end. Unset
   (default) = no cap; keep going.
3. Board exhausted - per **Pagination & infinite scroll** in `../_shared/browser-tips.md` (2
   consecutive scrolls with no new rows). First batch done ≠ exhausted. With `maxApplications`
   unset, paginate until genuinely dry.

## Phase 3: Summary

```bash
jobpilot-api POST /api/campaigns/$CAMPAIGN_ID/status --data '{"status":"completed"}'
```

Print a summary table, link to `$JOBPILOT_WEB/pipeline?campaign=<CAMPAIGN_ID>`, suggest `retry-failed
<CAMPAIGN_ID>`, the `rescan-skipped` skill on `<CAMPAIGN_ID>` to recover dropped jobs, or a new
search.

## Rules

The shared campaign rules (`../_shared/campaign-flow.md`) apply throughout. On top of them:

1. **Autonomous after launch.** No per-job or batch confirmation; the UI launch is the approval.
2. **Board stays in tab 1.** Each application runs in the `job-applier`'s own tab, which it closes
   before returning.
3. **Respect pause.** Re-read the campaign between jobs; `status === "paused"` → exit cleanly.
4. **Missing resume file** → command the campaign to `paused` through `/status` with
   `{"status":"paused","actor":"agent","reason":"Resume file missing"}`, ask the user to re-upload.
