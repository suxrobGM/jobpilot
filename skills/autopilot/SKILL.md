---
name: autopilot
description: Autonomously search job boards and apply to matching positions in batch. Tracks progress in the JobPilot database for resumability and live viewing. User approves a batch once, then Claude applies to all approved jobs without further prompts.
argument-hint: "<search_query OR 'resume' OR 'retry-failed <run-id>'>"
---

# Autopilot — Autonomous Job Application System

You autonomously search job boards, score results against the user's resume,
present a batch for one-time approval, then apply to every approved job
without further confirmation. Progress lives in the JobPilot database; the
live viewer at `http://127.0.0.1:8000/runs/<run-id>` reflects every state
change in real time.

## Setup

```bash
JOBPILOT_API=http://127.0.0.1:8000
```

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the
profile, resume, and credentials. Take `data.autopilot` from the profile
response as the configuration object. Apply these defaults if a field is
missing:

| Setting | Default | Description |
|---------|---------|-------------|
| `minMatchScore` | 6 | Minimum score (1-10) to qualify |
| `maxApplicationsPerRun` | 10 | Max jobs to apply to in one run |
| `skipCompanies` | [] | Company names to skip |
| `skipTitleKeywords` | [] | Title keywords to skip (e.g., "intern", "principal") |
| `confirmMode` | "batch" | `"batch"` reviews before applying. `"auto"` skips confirmation when ALL qualified jobs score >= `minMatchScore`. |
| `minSalary` | 0 | Skip jobs with listed comp below this. 0 = no filter. |
| `maxSalary` | 0 | Skip jobs above this. 0 = no filter. |
| `salaryExpectation` | "" | Auto-fill salary expectation fields. |
| `defaultStartDate` | "2 weeks notice" | Default start date answer. |

Inline argument overrides take precedence:
- `/jobpilot:autopilot "senior fullstack React remote" --min-score 7 --max-apps 5`

### Run Modes

Parse the argument:

- **`"resume"`** → list incomplete runs (`GET /api/runs?status=in_progress`),
  ask the user to pick one, then skip to Phase 3 with remaining
  `approved`/`pending` jobs.
- **`"retry-failed <run-id>"`** → fetch the run (`GET /api/runs/<id>`); for
  every job with `status === "failed"`, PATCH back to `"approved"` and read
  `retryNotes` so you can try a different approach. Then skip to Phase 3.
- **Anything else** → search query. Continue to Phase 0.

## Phase 0: Existing Run Check + Create

```bash
curl -fsS "$JOBPILOT_API/api/runs?status=in_progress"
```

If any returned run's `query` matches (or is very close to) the new search
query, ask: **"Found an incomplete run from `<startedAt>` with `<remaining>`
jobs left. Resume or start fresh?"**. Resume → skip to Phase 3.

Otherwise create a new run:

```bash
SLUG=$(echo "<query>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//')
RUN_ID=$(date -u +%Y-%m-%dT%H-%M-%S_${SLUG})
curl -fsS -X POST "$JOBPILOT_API/api/runs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg id "$RUN_ID" --arg q "<query>" \
    --argjson minScore <n> --argjson maxApps <n> \
    --argjson boards '["linkedin.com","indeed.com"]' \
    '{runId:$id, query:$q, source:"autopilot", config:{minMatchScore:$minScore, maxApplications:$maxApps, boards:$boards}}')"
```

Surface the live-view link to the user: `http://127.0.0.1:8000/runs/<RUN_ID>`.

## Phase 1: Search Job Boards

### Step 1.1: Parse the Query

Extract title/role, keywords, location, other preferences. If vague, ask the
user to clarify before searching.

### Step 1.2: Iterate Search Boards

```bash
curl -fsS "$JOBPILOT_API/api/job-boards"
```

For each board where `enabled === true` and `type === "search"`:

1. `browser_navigate` to `searchUrl`.
2. Follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/auth.md`.
3. Fill the search fields, submit, snapshot the results.
4. Extract up to 15 results: title, company, location, URL, brief description.
5. POST each found job to the run as a `pending` `RunJob` (description below).

`type === "ats"` boards (Greenhouse / Lever / Workday) are apply-only — skip
during search.

### Step 1.3: Dedupe + Previously-Applied Filter

Cross-board dedupe by normalized title + company; keep the richer entry.

For each remaining job, hit the dedupe API:

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `data.applied` is true, add the job to the run with
`status: "skipped"`, `skipReason: "Already applied (<kind>)"`.

### Step 1.4: Score and Add to Run

For each surviving job:

- Score 1-10 based on tech overlap, experience, education, domain, seniority,
  location.
- If below `minMatchScore` → status `"skipped"`,
  `skipReason: "Below minimum match score (X < Y)"`.
- If company in `skipCompanies` → `skipped`, `"Company in skip list"`.
- If title matches `skipTitleKeywords` → `skipped`, `"Title contains blocked keyword: <k>"`.
- If listed salary < `minSalary` (and minSalary > 0) → `skipped`,
  `"Salary below minimum"`.
- If listed salary > `maxSalary` (and maxSalary > 0) → `skipped`,
  `"Salary above maximum"`.
- Otherwise status `"pending"`.

POST every job to the run:

```bash
curl -fsS -X POST "$JOBPILOT_API/api/runs/$RUN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n \
    --arg key "<stable-id-within-run>" \
    --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<url>" --arg board "<board>" \
    --arg matchReason "<one line>" \
    --argjson score <0-100> \
    '{jobKey:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"pending"}')"
```

Salary filtering note: only filter when the listing explicitly shows a range
in the preview. Don't skip jobs that omit comp.

After scoring, PATCH the run summary to update counts (so the live viewer
reflects progress):

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson found <n> --argjson qualified <n> --argjson skipped <n> \
    '{summary:{totalFound:$found, qualified:$qualified, skipped:$skipped}}')"
```

## Phase 2: Confirmation

### Auto Mode (`confirmMode: "auto"`)

If every qualified job scores >= `minMatchScore`, PATCH all qualified jobs to
`status: "approved"` and skip to Phase 3. **If any qualified job is borderline,
fall back to batch mode** regardless of the setting — humans always review the
edge cases.

### Batch Mode (default)

```
## Autopilot Run: "<query>"

Found <totalFound> jobs across <N> boards. <qualified> qualify (score >= <minMatchScore>/10).

| # | Score | Title | Company | Location | Board |
|---|-------|-------|---------|----------|-------|
| 1 | 9/10  | Senior Full Stack Dev | Acme Corp | Remote | linkedin.com |

Live view: http://127.0.0.1:8000/runs/<RUN_ID>

**Commands:**
- "go" — apply to all qualified jobs
- "go 1,3,5" — apply only to specific jobs
- "remove 3,7" — exclude specific jobs
- "details 2" — show full description before deciding
- "stop" — pause the run
```

This is the **single confirmation gate.** After "go", apply autonomously.

Process commands by PATCHing `RunJob.status`:

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' -d '{"status":"approved"}'
```

`stop` → PATCH the run with `status: "paused"` and stop.

## Phase 3: Autonomous Apply Loop

For each job with `status: "approved"`, in score-descending order:

### Step 3.1: Mark Applying

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' -d '{"status":"applying"}'
```

### Step 3.2: Navigate, Find Apply

`browser_navigate` to the URL, snapshot, find/click the Apply button. After
clicking, `browser_wait_for` and re-snapshot.

### Step 3.3: Authentication

Follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/auth.md`.

**On login failure for a domain:** PATCH this job and every other approved
job on the same domain to `failed` with
`failReason: "Login failed for <domain>"`. Continue with jobs on other
domains.

### Step 3.4: Fill Forms

Follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/form-filling.md`. Use
`autopilot.salaryExpectation` (or ask the user once on first encounter and
remember for the rest of the run) and `autopilot.defaultStartDate`.

### Step 3.5: Submit

Submit autonomously — the user already approved the batch in Phase 2.
`browser_wait_for` confirmation, snapshot to verify.

### Step 3.6: Record Result

**On success** (one job-update event + one applied-jobs row + one summary update):

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"applied", appliedAt:$t}')"

curl -fsS -X POST "$JOBPILOT_API/api/applied" \
  -H 'content-type: application/json' \
  -d "$(jq -n \
    --arg url "<url>" --arg title "<title>" --arg company "<company>" \
    --arg board "<board>" --arg runId "$RUN_ID" \
    --argjson score <0-100> \
    '{url:$url, title:$title, company:$company, board:$board, source:"autopilot", runId:$runId, matchScore:$score}')"
```

**On failure** (any: CAPTCHA mid-form, unexpected page, validation error,
crash):

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID/jobs/<jobKey>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg r "<reason>" --arg notes "<actionable retry context>" \
    '{status:"failed", failReason:$r, retryNotes:$notes}')"
```

`retryNotes` examples (write actionable hints, not just descriptions):

- `"Quick Apply opened a broken iframe. Try the company careers page directly: https://company.com/careers"`
- `"Form required Portfolio URL field that's not in the profile. User should add it before retrying."`
- `"Login succeeded but app page returned 403. May need different credentials or a direct application URL."`

**Continue to the next job either way.** Don't stop on a single failure.

### Step 3.7: Limit Check

After every job, PATCH the run summary. If `summary.applied >=
config.maxApplications`, PATCH every remaining `approved` job to `skipped`
with `skipReason: "Max applications limit reached"` and end the loop.

### Step 3.8: Summary Updates

After every state change, PATCH the run with a fresh summary so the SSE viewer
reflects reality:

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson found <n> --argjson qualified <n> --argjson applied <n> \
                 --argjson failed <n> --argjson skipped <n> --argjson remaining <n> \
    '{summary:{totalFound:$found, qualified:$qualified, applied:$applied, failed:$failed, skipped:$skipped, remaining:$remaining}}')"
```

## Phase 4: Summary Report

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"completed", completedAt:$t}')"
```

Print a summary table and link to `http://127.0.0.1:8000/runs/<RUN_ID>` for
the full job-by-job breakdown. Suggest follow-ups:
- `retry-failed <RUN_ID>` to retry failures.
- A new search.

## Important Rules

1. **Batch confirmation is mandatory.** Phase 2 cannot be skipped. The user
   must explicitly approve before any submission.
2. **After approval, no per-job confirmation.** That's the whole point.
3. **Never create accounts** on any board. Skip the board if no credentials.
4. **Never process payments.** PATCH `failed` with
   `failReason: "Payment required"` and continue.
5. **Handle CAPTCHAs and email codes** by pausing and asking the user (see
   `auth.md`). Typically one-time per board.
6. **Be honest about match scores.** Don't inflate.
7. **Deduplicate** jobs across boards before Phase 2.
8. **Pace applications.** 3-5 seconds between submissions on the same domain.
9. **The Run is the audit trail.** PATCH after every state change. The SSE
   viewer surfaces this live to the user.
10. **If the resume file is missing**, PATCH the run to `paused` and ask the
    user to re-upload via the web UI before re-running.

Read and follow `${CLAUDE_PLUGIN_ROOT}/skills/_shared/browser-tips.md` for
handling large pages, popups, and general browser best practices.
