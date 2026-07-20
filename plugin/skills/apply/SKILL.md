---
name: apply
description: Apply to a single job (URL or pasted page) with fit review, or drain the pending queue when no argument is given.
argument-hint: "[job_url_or_pasted_job_page] (omit to drain the queue)"
---

# Apply - Single Job or Batch Queue

Two modes, one shared apply loop:

- **Single-job** (argument is a URL or pasted job page): fit review → user "yes" → apply one.
- **Batch** (no argument): drain `/api/queue/pending` → score → ranked table approval → apply all.

User approves once up front. No per-job confirmation after that.

## Setup

Follow `../../shared/setup.md` to load profile, resume, credentials.

```bash
JOBPILOT_API="${JOBPILOT_API:-https://jobpilot.suxrobgm.net}"
```

Read `autoApply` for config (defaults applied per field):

| Setting                      | Default            | Notes                                                                                            |
| ---------------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `minMatchScore`              | 60                 | Batch-mode threshold (0-100). Ignored in single-job mode.                                        |
| `maxApplicationsPerCampaign` | `null` (unlimited) | Sent as `config.maxApplications` when set; omit for unlimited batch. Single-job mode forces `1`. |
| `defaultStartDate`           | `"2 weeks notice"` | Default start-date answer.                                                                       |

For ATS portals (Greenhouse, Lever, Workday, etc.) the apply step lands on a domain that isn't in `/api/job-boards`; the `job-worker` handles login/registration there per `../../shared/auth.md`.

## Phase 0: Dispatch

- Argument is `campaign <campaign-id>` → **re-apply mode**: set `CAMPAIGN_ID=<campaign-id>`, set `config.maxApplications = null` (unlimited - the user hand-selected these jobs), skip Phases 1-4, and run the Phase 5 loop over its current `approved` jobs. (The campaign viewer - or the `rescan-skipped` skill - promotes the chosen skipped/failed jobs to `approved` before injecting this.)
- Any other argument present → **Phase 1** (single-job).
- No argument → **Phase 2** (batch).

---

## Phase 1: Single-Job Mode

If the argument is pasted content (HTML / text), extract description, Apply URL, company, title. If no Apply URL can be found, stop: **"I need either a job URL or content with a visible Apply link."**

### 1.1 Fit Review

**URL input** → delegate to the `job-worker` subagent with `mode:"review"` so the posting snapshot stays out of this conversation: `{ "mode":"review", "url":"<job-url>", "resumeId":"<primary-or-empty>" }`. Use its returned `matchScore`/`strongMatches`/`partialMatches`/`gaps`/`blockers`/`visaRisk`/`verdict` to fill the review below; keep its `digest` as `DIGEST` for 1.4.

**Pasted input** → parse the fields yourself (the content is already in hand), build the digest (`../../shared/digest-schema.md`), and `POST /api/score-fit` for the score. Keep the digest in `DIGEST=...` for 1.4.

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

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `.applied === true`, surface the match (title + company + appliedAt + `.match.kind`) and ask whether to proceed anyway. Stop on no.

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

### 2.1 Pull Queue

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/queue/pending"
```

`data` is `[{ id, url, note, status }]`. If empty, tell user to open `$JOBPILOT_WEB/queue` to add URLs and stop. Otherwise: **"Found N URLs in the queue. Visiting each to gather details..."**

### 2.2 Create Campaign

```bash
CAMPAIGN=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns" \
  -H 'content-type: application/json' \
  -d '{"query":"apply queue","source":"apply","config":{"minScore":6,"maxApplications":10}}')
CAMPAIGN_ID=$(echo "$CAMPAIGN" | jq -r '.campaignId')
```

## Phase 3: Visit and Score (Batch Only)

For each queue URL:

### 3.1 Pre-dedupe (no tab)

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED"
```

If applied, mark the queue entry consumed, create the Job as `pending`, then POST its `/result` with `outcome:"skipped"`, `skipReason:"Already applied (<kind>)"`; continue without spawning a worker.

### 3.2 Score (delegate to `job-worker`)

Delegate the visit + score to the `job-worker` subagent - it opens its own tab, reads the posting, fuzzy-dedupes by title+company, scores, applies eligibility (`../../shared/eligibility.md`), and **saves the Job row itself** (so the full posting/digest never enters this conversation). One worker at a time. Input JSON:

```json
{ "mode": "score", "campaignId": "<CAMPAIGN_ID>", "jobKey": "<entry-id>", "url": "<job-url>",
  "board": "<domain>", "minMatchScore": <minMatchScore>, "resumeId": "<RESUME_ID>" }
```

It returns `{ outcome:"scored", jobKey, title, company, location, matchScore, confidence, eligible, skipReason, matchReason }`. Collect these summaries for the ranked table (Phase 4) - the worker has already written each Job as `pending` (eligible) or `skipped` (with `skipReason`).

## Phase 4: Batch Confirmation (Batch Only)

**Auto mode** (`confirmMode: "auto"` AND every qualified job ≥ threshold): PATCH all to `approved`, go to Phase 5.

**Batch mode** (default): present ranked table.

```
## Batch Apply

Visited <total> jobs. <qualified> qualify (score >= minMatchScore/100).

| # | Score  | Title | Company | Location | Board |
|---|--------|-------|---------|----------|-------|

**Commands:** "go" | "go 1,3,5" | "remove 3" | "details 2" | "stop"
```

Use PATCH only for approval; record every skip through `/result`:

- `go` → all qualified to `approved`
- `go N,M` → selected to `approved`; rest to `skipped` (`"Not selected by user"`)
- `remove N` → that job to `skipped` (`"Removed by user"`); re-present table
- `stop` → POST `/api/campaigns/$CAMPAIGN_ID/status` with `{status:"paused"}` and stop

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

Delegate to the `job-worker` subagent and wait for its compact result - it navigates, authenticates, tailors, fills, and submits in its own tab/context (keeping the form snapshots out of this conversation). One worker at a time. Input JSON:

```json
{ "mode": "apply", "campaignId": "<CAMPAIGN_ID>", "jobKey": "<key>", "url": "<job-url>",
  "board": "<domain>", "resumeId": "<RESUME_ID>", "defaultStartDate": "<autoApply.defaultStartDate>",
  "salaryExpectation": <remembered-or-null>, "preSubmitReview": <true when config.maxApplications === 1, else false> }
```

(`digest` omitted → the worker fetches it from the saved Job.)

**Single-job pre-submit review:** when `preSubmitReview` is true the worker fills everything, leaves the form open, and returns `needs_user category:"review"` with a field summary in `context`. Present:

```
## Ready to Submit: [Title] at [Company]
| Name | Email | Phone | Resume | Salary | Start date | Cover letter | Custom Qs |
<total> fields across <P> page(s). Submit? (yes / no / edit <field>)
```

`yes` → re-delegate 5.2 with `preSubmitReview:false` (the worker submits the already-filled form). `no` → POST `/result` `outcome:"skipped"`, `skipReason:"User cancelled at pre-submit review"`. `edit <field>` → tell the worker what to change on re-delegation.

### 5.3 Record Result

Map the worker's `outcome` to `/result` (the worker never writes it). The server atomically updates the Job, creates the Application and initial event on `applied`, and marks the queue; responses derive summaries from current rows.

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# applied
jq -n --arg t "$NOW" --argjson score <0-100> '{outcome:"applied", appliedAt:$t, matchScore:$score}'
# failed
jq -n --arg r "<failReason>" --arg notes "<retryNotes>" '{outcome:"failed", failReason:$r, retryNotes:$notes}'
# skipped (e.g. CAPTCHA, user cancelled, max-apps cap)
jq -n --arg r "<skipReason>" '{outcome:"skipped", skipReason:$r}'
```

`needs_user`: `category:"salary"` (no profile salary preference matched) → ask once, remember for the campaign, re-delegate 5.2 with `salaryExpectation`; `category:"verification"` → pause and ask; `category:"payment"` → POST `/result` `failed` `"Payment required"`. The worker closed its tabs; re-select tab 0, then continue.

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

1. **Up-front confirmation mandatory** (1.1 or Phase 4); single-job mode adds pre-submit review (5.2).
2. **Create accounts when needed** - the `job-worker` follows `../../shared/auth.md`: register when no account exists (without asking), run forgot-password when the stored password is stale.
3. **Never process payments** - on `needs_user category:"payment"`, POST `/result` `outcome:"failed"`, `failReason:"Payment required"`.
4. **CAPTCHAs / email verification** - the worker attempts `solve-captcha` and returns `skipped` when unsolved; for `needs_user category:"verification"`, pause and ask (see `../../shared/auth.md`).
5. **Be honest about match scores.**
6. **Pace** 3-5s between submissions on the same domain.
7. **The Campaign is the audit trail.** PATCH non-terminal transitions; POST `/result` for terminal outcomes.
8. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason`. No valid reason → not a skip.
