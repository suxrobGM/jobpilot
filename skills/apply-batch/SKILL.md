---
name: apply-batch
description: Apply to a queued list of job URLs from the JobPilot batch input. Visits each, scores against your resume, presents a ranked batch for approval, then applies autonomously.
argument-hint: "(none — pulls pending URLs from /api/batch/pending)"
---

# Batch Apply - Apply to a Queued List of Job URLs

You apply to a queued list of jobs managed in the JobPilot web app. URLs are
added through the web UI (`http://127.0.0.1:8000/batch`) or via
`POST /api/batch`; this skill pulls the pending queue, scores each job,
presents a ranked batch for approval, and applies autonomously.

## Setup

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the profile, resume, and credentials.

```bash
JOBPILOT_API=http://127.0.0.1:8000
```

### Load Configuration

Read `data.autopilot` from the profile response (already loaded by setup.md).
Apply these defaults if a field is missing:

| Setting | Default | Description |
|---------|---------|-------------|
| `minMatchScore` | 6 | Minimum score (1-10) to include in batch |
| `maxApplicationsPerRun` | 10 | Max jobs to apply to |
| `confirmMode` | "batch" | `"batch"` = review before applying. `"auto"` = skip confirmation when ALL jobs score >= `minMatchScore`. |
| `salaryExpectation` | "" | Auto-fill salary expectation fields |
| `defaultStartDate` | "2 weeks notice" | Default answer for start date fields |

## Phase 1: Pull the Pending Batch

```bash
curl -fsS "$JOBPILOT_API/api/batch/pending"
```

`data` is an array of `{ id, url, note, status }`. If empty, tell the user:

> No pending URLs in the batch queue. Open http://127.0.0.1:8000/batch to add
> some, or paste a list in the Batch page.

Otherwise report: **"Found N URLs in the batch queue. Visiting each to gather
details..."**

### Create the Run

```bash
RUN_ID=$(date -u +%Y-%m-%dT%H-%M-%S_batch-apply)
curl -fsS -X POST "$JOBPILOT_API/api/runs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg runId "$RUN_ID" \
    '{runId:$runId, query:"batch-apply queue", source:"apply-batch", config:{minMatchScore:6, maxApplications:10}}')"
```

Hold on to `RUN_ID` for the rest of the run. The created `Run` is now visible
at `http://127.0.0.1:8000/runs/<RUN_ID>`.

## Phase 2: Visit and Score Each Job

For each URL in the batch:

### Step 2.1: Check if Already Applied

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
curl -fsS "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED"
```

If `data.applied === true`, mark the batch entry consumed (skipped) and add it
as a skipped job in the run:

```bash
# Mark batch entry consumed
curl -fsS -X PATCH "$JOBPILOT_API/api/batch/<batch-id>" \
  -H 'content-type: application/json' -d '{"status":"skipped"}'

# Add to run as skipped
curl -fsS -X POST "$JOBPILOT_API/api/runs/$RUN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<batch-id>" --arg url "<job-url>" \
    '{jobKey:$key, title:"(unknown)", company:"(unknown)", url:$url, status:"skipped"}')"
```

Then move on. (Use a richer fuzzy check `?title=...&company=...` once you've
visited the page.)

### Step 2.2: Visit the Job Page

1. Use `browser_navigate` to open the URL.
2. Use `browser_snapshot` with a targeted `ref` to read the listing.
3. Extract title, company, location, salary, board, key requirements.
4. If login is required, follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/auth.md` first, then re-read.

Re-run the dedupe check now that you have title + company:

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<job-title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

### Step 2.3: Score and Add to Run

Assign a match score (1-10). Add a `RunJob` to the run:

```bash
curl -fsS -X POST "$JOBPILOT_API/api/runs/$RUN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n \
    --arg key "<batch-id>" \
    --arg title "<title>" \
    --arg company "<company>" \
    --arg location "<location>" \
    --arg url "<job-url>" \
    --arg board "<board>" \
    --arg matchReason "<one-line why>" \
    --argjson score <0-100> \
    '{jobKey:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"pending"}')"
```

If the score is below `minMatchScore × 10`, immediately PATCH the job to
`skipped` with `skipReason: "Below minimum match score (X < Y)"`.

## Phase 3: Batch Confirmation

### Auto Mode (`confirmMode: "auto"`)

When every qualified job is above threshold, PATCH all qualified jobs to
`status: "approved"` and proceed to Phase 4.

### Batch Mode (`confirmMode: "batch"`, default)

Present the qualified jobs in a ranked table:

```
## Batch Apply

Visited <total> jobs. <qualified> qualify (score >= <minMatchScore>/10).

| # | Score | Title | Company | Location | Board |
|---|-------|-------|---------|----------|-------|
| 1 | 9/10  | Senior Full Stack Dev | Acme Corp | Remote | greenhouse.io |

**Commands:**
- "go" — apply to all qualified jobs
- "go 1,3,5" — apply only to specific jobs
- "remove 3" — exclude specific jobs
- "details 2" — show full description before deciding
- "stop" — pause the run
```

Process the response by PATCHing each job's status:
- `go` → set every qualified job to `approved`
- `go 1,3,5` → those become `approved`; rest become `skipped` with `skipReason: "Not selected by user"`
- `remove N` → that job becomes `skipped` with `skipReason: "Removed by user"`, re-present table
- `stop` → PATCH the run with `status: "paused"`, save, stop

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' -d '{"status":"approved"}'
```

## Phase 4: Autonomous Apply Loop

For each job with `status: "approved"`, in score-descending order:

### Step 4.1: Mark Applying

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' -d '{"status":"applying"}'
```

### Step 4.2: Navigate, Find Apply, Authenticate

Same flow as the `apply` skill — navigate, find Apply, follow `auth.md` if a
login page is hit.

### Step 4.3: Fill Forms

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/form-filling.md`. Use
`autopilot.salaryExpectation` and `autopilot.defaultStartDate` from the profile
response for the standard salary/start-date fields.

### Step 4.4: Submit

Submit without per-job confirmation — the user approved the batch in Phase 3.
`browser_wait_for` confirmation, take a targeted snapshot to verify.

### Step 4.5: Record Result

**On success:**

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# Update RunJob status
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"applied", appliedAt:$t}')"

# Log to persistent applications table
curl -fsS -X POST "$JOBPILOT_API/api/applied" \
  -H 'content-type: application/json' \
  -d "$(jq -n \
    --arg url "<job-url>" --arg title "<title>" --arg company "<company>" \
    --arg board "<board>" --arg runId "$RUN_ID" \
    --argjson matchScore <0-100> \
    '{url:$url, title:$title, company:$company, board:$board, source:"apply-batch", runId:$runId, matchScore:$matchScore}')"

# Mark batch entry consumed
curl -fsS -X PATCH "$JOBPILOT_API/api/batch/<batch-id>" \
  -H 'content-type: application/json' -d '{"status":"consumed"}'
```

**On failure:**

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg r "<reason>" --arg notes "<actionable retry notes>" \
    '{status:"failed", failReason:$r, retryNotes:$notes}')"
```

**Continue to the next job either way.**

### Step 4.6: Update Run Summary

After every job, PATCH the run with the running summary:

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson found <n> --argjson qualified <n> --argjson applied <n> \
                 --argjson failed <n> --argjson skipped <n> --argjson remaining <n> \
    '{summary:{totalFound:$found, qualified:$qualified, applied:$applied, failed:$failed, skipped:$skipped, remaining:$remaining}}')"
```

This emits an SSE `progress` event so the live viewer at
`http://127.0.0.1:8000/runs/<RUN_ID>` updates in real time.

### Step 4.7: Check Limits

If `applied >= config.maxApplications`, PATCH every remaining `approved` job
to `skipped` with `skipReason: "Max applications limit reached"`, then end the
loop.

## Phase 5: Summary

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"completed", completedAt:$t}')"
```

Print a summary table and point the user at `http://127.0.0.1:8000/runs/<RUN_ID>` for the live view.

## Important Rules

1. **Batch confirmation is mandatory.** The user must approve before any applications are submitted.
2. **After approval, do NOT ask per-job confirmation.** Apply autonomously.
3. **Never create accounts** on any job board.
4. **Never process payments.** PATCH the job as `failed` with `failReason: "Payment required"`.
5. **Handle CAPTCHAs and email verification** by pausing and asking the user (see `auth.md`).
6. **Be honest about match scores.** Don't inflate.
7. **Pace applications.** Wait 3-5 seconds between submissions on the same domain.
8. **The Run is the audit trail.** PATCH after every state change so the SSE viewer reflects reality.

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/browser-tips.md` for handling large pages, popups, and general browser best practices.
