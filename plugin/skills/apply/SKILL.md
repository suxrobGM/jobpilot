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

Read `autoApply` for config (defaults applied per field):

| Setting                      | Default            | Notes                                                                                            |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `minMatchScore`              | 60                 | Batch-mode threshold (0-100); the campaign's `config.minScore` wins when set. Ignored in single-job mode. |
| `maxApplicationsPerCampaign` | `null` (unlimited) | Sent as `config.maxApplications` when set; omit for unlimited batch. Single-job mode forces `1`. |
| `defaultStartDate`           | `"2 weeks notice"` | Default start-date answer.                                                                       |

For ATS portals (Greenhouse, Lever, Workday, etc.) the apply step lands on a domain that isn't in `/api/job-boards`; the `job-worker` handles login/registration there per `../_shared/auth.md`.

## Phase 0: Dispatch

- Argument is `campaign <campaign-id>` → set `CAMPAIGN_ID=<campaign-id>` and fetch it first (`GET /api/campaigns/$CAMPAIGN_ID`); the summary decides which of the two branches runs:
  - `summary.byStatus.queued > 0` → the campaign still holds pasted links nobody has visited: go to **Phase 2**, skipping 2.1 (the campaign is already resolved).
  - otherwise → **re-apply mode**: set `config.maxApplications = null` (unlimited - the user hand-selected these jobs), skip Phases 1-4, and run the Phase 5 loop over its current `approved` jobs. (The campaign viewer - or the `rescan-skipped` skill - promotes the chosen skipped/failed jobs to `approved` before injecting this.)
- Any other argument present → **Phase 1** (single-job).
- No argument → **Phase 2** (batch).

---

## Phase 1: Single-Job Mode

If the argument is pasted content (HTML / text), extract description, Apply URL, company, title. If no Apply URL can be found, stop: **"I need either a job URL or content with a visible Apply link."**

### 1.1 Fit Review

**URL input** → delegate to the `job-worker` subagent with `mode:"review"` so the posting snapshot stays out of this conversation: `{ "mode":"review", "url":"<job-url>", "resumeId":"<primary-or-empty>" }`. Use its returned `matchScore`/`strongMatches`/`partialMatches`/`gaps`/`blockers`/`visaRisk`/`recommendation` to fill the review below; keep its `digest` as `DIGEST` for 1.4.

**Pasted input** → parse the fields yourself (the content is already in hand), build the digest (`../_shared/digest-schema.md`), and `POST /api/score-fit {digest, minScore:<minMatchScore>}` for the score. Its `fit.verdict` drives the recommendation below: `trust` → report the score as-is; `deliberate` → reason from `strongMatches`/`partialMatches`/`gaps` first. Keep the digest in `DIGEST=...` for 1.4.

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
CAMPAIGN=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg query "<title> at <company>" \
    '{query:$query, source:"apply", config:{maxApplications:1}}')")
CAMPAIGN_ID=$(echo "$CAMPAIGN" | jq -r '.campaignId')
```

### 1.4 Add the Job

```bash
JOB_KEY=$(date -u +%s)-single
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "$JOB_KEY" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<job-url>" --arg board "<board>" \
    --arg matchReason "<one-line verdict>" --argjson score <0-100> \
    --arg digest "$DIGEST" --arg desc "<posting text>" \
    '{key:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"approved", digest:$digest, description:$desc}')"
```

Keep `$CAMPAIGN_ID` and `$JOB_KEY`. Live view: `$JOBPILOT_WEB/campaigns/<CAMPAIGN_ID>`. Jump to **Phase 5**.

---

## Phase 2: Batch Mode

The campaign already exists (the new-campaign dialog creates it); its rows start `queued` - a
bare URL with a hostname placeholder title. This skill never creates one. Phase 3 turns those
rows into real, scored `pending` jobs.

### 2.1 Resolve the Campaign

Skip this when the `campaign <id>` dispatch already set `CAMPAIGN_ID`. Otherwise take the newest
`apply` campaign still holding queued rows (`.items` is newest-first):

```bash
CAMPAIGN_ID=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" \
  "$JOBPILOT_API/api/campaigns?status=in_progress&source=apply&jobStatus=queued&page=1&limit=1" \
  | jq -r '.items[0].campaignId // ""')
```

Empty → **"Nothing queued. Start a campaign at $JOBPILOT_WEB/campaigns/new, pick Apply to
links, and run this again."** and stop. Otherwise read `config` off that same campaign row:
`minScore` overrides `minMatchScore`,
`resumeId` overrides the primary resume, `maxApplications` caps Phase 5.

### 2.2 Load the Queued Rows

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" \
  "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs?status=queued&page=1&limit=100"
```

Keep each row's `key` and `url` - those two are all a queued row carries that is worth trusting.
Announce: **"Found N queued links. Visiting each to gather details..."**

## Phase 3: Visit and Score (Batch Only)

### 3.1 Pre-dedupe (no tab)

For each queued row, run the applied-check (`../_shared/campaign-flow.md`) with the URL alone. On
`.applied`, post the terminal result straight from `queued` (legal from any non-terminal status):

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs/<key>/result" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg r "Already applied (<kind>)" '{outcome:"skipped", skipReason:$r}')"
```

Drop that row from the batch and continue without spawning a worker.

### 3.2 Score (delegate to `job-worker`)

Delegate the surviving rows to the `job-worker` subagent - it opens its own tab, reads each
posting, fuzzy-dedupes by title+company, scores, applies eligibility
(`../_shared/eligibility.md`), and **writes each row itself** (so the full posting/digest never
enters this conversation). Batches of at most 5 rows (the worker's cap), one worker at a time.
Input JSON:

```json
{ "mode": "score", "campaignId": "<CAMPAIGN_ID>", "save": "patch",
  "jobs": [{ "jobKey": "<row key>", "url": "<row url>" }],
  "minMatchScore": <minMatchScore>, "resumeId": "<RESUME_ID>" }
```

`save:"patch"` keeps this on the existing rows: the worker PATCHes the real title, company,
location, board, score, and digest onto each eligible row (`queued` → `pending`); an ineligible
or already-applied row gets a `/result` `skipped` instead.

It returns one `{ outcome:"scored", jobKey, title, company, location, matchScore, confidence, eligible, skipReason, matchReason }` per row. Collect these summaries for the ranked table (Phase 4).

## Phase 4: Batch Confirmation (Batch Only)

Rank the rows the worker left `pending` - the ones it skipped are already terminal and out of the
running.

**Auto mode** (`confirmMode: "auto"` AND every qualified job ≥ threshold): PATCH all to `approved`, go to Phase 5.

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
- `stop` → POST `/api/campaigns/$CAMPAIGN_ID/status` with `{status:"paused", actor:"user", reason:"Stopped from the terminal"}` and stop

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs/<key>" \
  -H 'content-type: application/json' -d '{"status":"approved"}'
```

## Phase 5: Apply Loop

For each `approved` job, score-descending:

### 5.1 Mark Applying

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs/<key>" \
  -H 'content-type: application/json' -d '{"status":"applying"}'
```

### 5.2 Apply (delegate to `job-worker`)

Delegate to the `job-worker` subagent and wait for its compact result - it navigates, authenticates, tailors, fills, and submits in its own tab/context (keeping the form snapshots out of this conversation). One worker at a time. Use the apply-mode input from `../_shared/campaign-flow.md` with `digest` omitted (the worker fetches it from the saved Job) and `preSubmitReview: <true when config.maxApplications === 1, else false>`.

**Single-job pre-submit review:** when `preSubmitReview` is true the worker fills everything, leaves the form open, and returns `needs_user category:"review"` with a field summary in `context`. Present:

```
## Ready to Submit: [Title] at [Company]
| Name | Email | Phone | Resume | Salary | Start date | Cover letter | Custom Qs |
<total> fields across <P> page(s). Submit? (yes / no / edit <field>)
```

`yes` → re-delegate 5.2 with `preSubmitReview:false` (the worker submits the already-filled form). `no` → POST `/result` `outcome:"skipped"`, `skipReason:"User cancelled at pre-submit review"`. `edit <field>` → tell the worker what to change on re-delegation.

### 5.3 Record Result

Map the worker's `outcome` to a terminal `/result` write and route `needs_user` per
`../_shared/campaign-flow.md` (the worker never writes results itself; on `salary`,
re-delegate 5.2 with `salaryExpectation` set).

### 5.4 Limit

If `config.maxApplications` is set and `applied >= config.maxApplications`, stop the loop. Leave remaining `approved` jobs as-is.

## Phase 6: Summary

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/status" \
  -H 'content-type: application/json' \
  -d '{"status":"completed"}'
```

Print a summary table and link to `$JOBPILOT_WEB/campaigns/<CAMPAIGN_ID>`.

## Rules

The shared campaign rules (`../_shared/campaign-flow.md`) apply throughout. On top of them:

1. **Up-front confirmation mandatory** (1.1 or Phase 4); single-job mode adds pre-submit review (5.2).
