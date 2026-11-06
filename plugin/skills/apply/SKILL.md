---
name: apply
description: Apply to a single job (URL or pasted page) with fit review, or score and apply the job links pasted into an apply campaign when no argument is given.
argument-hint: "[job_url_or_pasted_job_page | campaign <id>] (omit to pick up your pasted links)"
---

# Apply - Single Job or Pasted Links

Two modes, one shared apply loop:

- **Single-job** (argument is a URL or pasted job page): fit review → user "yes" → apply one.
- **Batch** (no argument, or a campaign that still holds `queued` links): score the campaign's
  `queued` rows → ranked table approval → apply all.

User approves once up front. No per-job confirmation after that.

## Setup

Follow `../_shared/setup.md` to load profile, resume, credentials. Shared campaign mechanics
(applied-check, result writes, worker input, rules) live in `../_shared/campaign-flow.md`.

`minMatchScore` = `GET /api/pilot` → `config.minScore` (default 60): the batch-mode threshold,
which the campaign's `config.minScore` overrides when set. Single-job mode ignores it.

For ATS portals (Greenhouse, Lever, Workday, etc.) the apply step lands on a domain that isn't in
`/api/job-boards`; the `job-applier` handles login/registration there per `../_shared/auth.md`.

## Phase 0: Dispatch

- Argument is `campaign <campaign-id>` → set `CAMPAIGN_ID=<campaign-id>` and fetch it first (`GET
  /api/campaigns/$CAMPAIGN_ID`); the summary decides which of the two branches runs:
  - `summary.byStatus.queued > 0` → the campaign still holds pasted links nobody has visited: go
    to **Phase 2**, skipping 2.1 (the campaign is already resolved).
  - otherwise → **re-apply mode**: set `config.maxApplications = null` (unlimited - the user
    hand-selected these jobs), skip Phases 1-4, and run the Phase 5 loop over its current `approved`
    jobs. (The campaign viewer - or the `rescan-skipped` skill - promotes the chosen skipped/failed
    jobs to `approved` before injecting this.)
- Any other argument present → **Phase 1** (single-job).
- No argument → **Phase 2** (batch).

---

## Phase 1: Single-Job Mode

If the argument is pasted content (HTML / text), extract description, Apply URL, company, title. If
no Apply URL can be found, stop: **"I need either a job URL or content with a visible Apply link."**

### 1.1 Fit Review

**URL input** → delegate to the `job-scorer` subagent with `mode:"review"` so the posting snapshot
stays out of this conversation: `{ "mode":"review", "url":"<job-url>",
"resumeId":"<primary-or-empty>" }`. Use its returned
`matchScore`/`strongMatches`/`partialMatches`/`gaps`/`blockers`/`visaRisk`/`recommendation` to fill
the review below; keep its `brief` as `BRIEF` for 1.4.

**Pasted input** → parse the fields yourself (the content is already in hand), build the brief
(`../_shared/job-brief.md`), and `POST /api/fit-scores {brief, minScore:<minMatchScore>}` for the
score. Its `fit.verdict` drives the recommendation below: `trust` → report the score as-is;
`deliberate` → reason from `strongMatches`/`partialMatches`/`gaps` first. Keep the brief in
`BRIEF=...` for 1.4.

```
## Job Fit Review: [Title] at [Company]

**Match Score: X/100**

**Strong Matches:** [skill - evidence]
**Partial Matches:** [skill - what's adjacent]
**Gaps:** [skill - what's missing]
**Visa/Sponsorship Risk:** [if mentioned]
**Verdict:** [1-2 sentence recommendation]
```

Ask: **"Want me to proceed with the application?"** - `yes`/`go` continue, anything else stop.

### 1.2 Dedupe Check

Run the applied-check (`../_shared/campaign-flow.md`) with url + title + company. If
`.applied === true`, surface the match (title + company + appliedAt + `.match.kind`) and ask
whether to proceed anyway. Stop on no.

### 1.3 Create Campaign-of-1

```bash
jobpilot-api POST /api/campaigns \
  --data '{"query":"<title> at <company>","source":"apply","config":{"maxApplications":1}}'
```

Keep `.id` from the response as `CAMPAIGN_ID`.

### 1.4 Add the Job

Pick a `JOB_KEY` of `<unix-seconds>-single`. Write the body to `"$JOBPILOT_TEMP/job.json"` (`brief`
is the stringified brief, `description` the posting text):

```json
{ "key": "<JOB_KEY>", "title": "<title>", "company": "<company>", "location": "<location>",
  "url": "<job-url>", "board": "<board>", "matchScore": <0-100>, "matchReason": "<one-line verdict>",
  "status": "approved", "brief": "<stringified brief>", "description": "<posting text>" }
```

```bash
jobpilot-api POST "/api/campaigns/$CAMPAIGN_ID/jobs" --data @"$JOBPILOT_TEMP/job.json"
```

A response with `duplicate: true` means the user already has this posting from the last 30 days:
set `$CAMPAIGN_ID` and `$JOB_KEY` from its `campaignId` and `key`, and if its `status` is
`applied`, tell the user and stop. Keep `$CAMPAIGN_ID` and `$JOB_KEY`. Live view: `$JOBPILOT_WEB/pipeline?campaign=<CAMPAIGN_ID>`. Jump
to **Phase 5**.

---

## Phase 2: Batch Mode

The campaign already exists (the new-campaign dialog creates it); its rows start `queued` - a
bare URL with a hostname placeholder title. This skill never creates one. Phase 3 turns those
rows into real, scored `pending` jobs.

### 2.1 Resolve the Campaign

Skip this when the `campaign <id>` dispatch already set `CAMPAIGN_ID`. Otherwise take the newest
`apply` campaign still holding queued rows (`.items` is newest-first):

```bash
jobpilot-api GET /api/campaigns --query status=in_progress --query source=apply \
  --query jobStatus=queued --query page=1 --query limit=1
```

Take `.items[0].id` as `CAMPAIGN_ID`. Empty `.items` → **"Nothing queued. Add job links
in the Pipeline at $JOBPILOT_WEB/pipeline, then run this again."** and stop. Otherwise read
`config` off that same campaign row: `minScore` overrides `minMatchScore`, `resumeId` overrides the
primary resume, `maxApplications` caps Phase 5.

### 2.2 Load the Queued Rows

```bash
jobpilot-api GET "/api/campaigns/$CAMPAIGN_ID/jobs" --query status=queued --query page=1 --query limit=100
```

Keep each row's `key` and `url` - those two are all a queued row carries that is worth trusting.
Announce: **"Found N queued links. Visiting each to gather details..."**

## Phase 3: Visit and Score (Batch Only)

### 3.1 Pre-dedupe (no tab)

For each queued row, run the applied-check (`../_shared/campaign-flow.md`) with the URL alone. On
`.applied`, post the terminal result straight from `queued` (legal from any non-terminal status):

```bash
jobpilot-api POST "/api/campaigns/$CAMPAIGN_ID/jobs/<key>/result" \
  --data '{"outcome":"skipped","skipReason":"Already applied (<kind>)"}'
```

Drop that row from the batch and continue without spawning a worker.

### 3.2 Score (delegate to `job-scorer`)

Delegate the surviving rows to the `job-scorer` subagent - it opens its own tab, reads each
posting, fuzzy-dedupes by title+company, scores, applies eligibility
(`../_shared/eligibility.md`), and **writes each row itself** (so the full posting/brief never
enters this conversation). Batches of at most 5 rows (the worker's cap), one worker at a time.
Input JSON:

```json
{ "mode": "score", "campaignId": "<CAMPAIGN_ID>", "save": "patch",
  "jobs": [{ "jobKey": "<row key>", "url": "<row url>" }],
  "minMatchScore": <minMatchScore>, "resumeId": "<RESUME_ID>" }
```

`save:"patch"` keeps this on the existing rows: the worker PATCHes the real title, company,
location, board, score, and brief onto each eligible row (`queued` → `pending`); an ineligible
or already-applied row gets a `/result` `skipped` instead.

It returns one `{ outcome:"scored", jobKey, title, company, location, matchScore, confidence,
eligible, skipReason, matchReason }` per row. Collect these summaries for the ranked table (Phase
4).

## Phase 4: Batch Confirmation (Batch Only)

Rank the rows the worker left `pending` - the ones it skipped are already terminal and out of the
running.

**Auto mode** (`confirmMode: "auto"` AND every qualified job ≥ threshold): PATCH all to `approved`,
go to Phase 5.

**Batch mode** (default): present ranked table.

```
## Batch Apply

Visited <total> jobs. <qualified> qualify (score >= minMatchScore, out of 100).

| # | Score  | Title | Company | Location | Board |
|---|--------|-------|---------|----------|-------|

**Commands:** "go" | "go 1,3,5" | "remove 3" | "details 2" | "stop"
```

Use PATCH only for approval; record every skip through `/result`:

- `go` → all qualified to `approved`
- `go N,M` → selected to `approved`; rest to `skipped` (`"Not selected by user"`)
- `remove N` → that job to `skipped` (`"Removed by user"`); re-present table
- `stop` → POST `/api/campaigns/$CAMPAIGN_ID/status` with `{status:"paused", actor:"user",
  reason:"Stopped from the terminal"}` and stop

```bash
jobpilot-api PATCH "/api/campaigns/$CAMPAIGN_ID/jobs/<key>" --data '{"status":"approved"}'
```

## Phase 5: Apply Loop

For each `approved` job, score-descending:

### 5.1 Mark Applying

```bash
jobpilot-api PATCH "/api/campaigns/$CAMPAIGN_ID/jobs/<key>" --data '{"status":"applying"}'
```

### 5.2 Apply (delegate to `job-applier`)

Delegate to the `job-applier` subagent and wait for its compact result - it navigates,
authenticates, tailors, fills, and submits in its own tab/context (keeping the form snapshots out of
this conversation). One worker at a time. Use the `job-applier` input from
`../_shared/campaign-flow.md` with `brief` omitted (the worker fetches it from the saved Job) and
`preSubmitReview: <true when config.maxApplications === 1, else false>`.

**Single-job pre-submit review:** when `preSubmitReview` is true the worker fills everything, leaves
the form open, and returns `needs_user category:"review"` with a field summary in `context`.
Present:

```
## Ready to Submit: [Title] at [Company]
| Name | Email | Phone | Resume | Salary | Start date | Cover letter | Custom Qs |
<total> fields across <P> page(s). Submit? (yes / no / edit <field>)
```

`yes` → re-delegate 5.2 with `preSubmitReview:false` (the worker submits the already-filled form).
`no` → POST `/result` `outcome:"skipped"`, `skipReason:"User cancelled at pre-submit review"`. `edit
<field>` → tell the worker what to change on re-delegation.

### 5.3 Record Result

Map the worker's `outcome` to a terminal `/result` write and route `needs_user` per
`../_shared/campaign-flow.md` (the worker never writes results itself; on `salary`,
re-delegate 5.2 with `salaryExpectation` set).

### 5.4 Limit

If `config.maxApplications` is set and `applied >= config.maxApplications`, stop the loop. Leave
remaining `approved` jobs as-is.

## Phase 6: Summary

```bash
jobpilot-api POST "/api/campaigns/$CAMPAIGN_ID/status" --data '{"status":"completed"}'
```

Print a summary table and link to `$JOBPILOT_WEB/pipeline?campaign=<CAMPAIGN_ID>`.

## Rules

The shared campaign rules (`../_shared/campaign-flow.md`) apply throughout. On top of them:

1. **Up-front confirmation mandatory** (1.1 or Phase 4); single-job mode adds pre-submit review
   (5.2).
