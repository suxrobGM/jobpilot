---
name: auto-apply
description: Search a chosen job board and apply to matching jobs on demand — score each result as it's found and apply to qualifying ones one at a time, the board kept open in one tab and each application run in a second tab. Autonomous after launch; runs until the user pauses, the board exhausts, or the optional max-applications cap is hit.
argument-hint: "<search_query --board <domain> [--min-score N] [--max-apps N]> OR 'resume' OR 'retry-failed <run-id>'"
---

# Auto-apply — Search + Apply On Demand

Keep the chosen board open in tab 1; for each result that qualifies, apply in a second tab, then close it and move to the next job. **No batch pre-discovery and no per-job approval — launching the run is the confirmation.** Pause only for true blockers (CAPTCHA / 2FA / payment). Live view at `http://localhost:8000/runs/<run-id>`.

## Setup

```bash
JOBPILOT_API=http://localhost:8000
```

Follow `plugin/skills/shared/setup.md`. Read `data.autoApply` (defaults applied per field):

| Setting                 | Default            | Notes                                                                                     |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `minMatchScore`         | 70                 | Qualification threshold (0–100). Inline `--min-score` overrides.                          |
| `maxApplicationsPerRun` | `null` (unlimited) | Stop after this many successful applies. Inline `--max-apps` overrides; omit → unlimited. |
| `defaultStartDate`      | `"2 weeks notice"` | Default start-date answer.                                                                |

Inline argument overrides take precedence. `--board <domain>` is **required** unless the argument is `resume` or `retry-failed <run-id>`.

### Run Modes

- `"resume"` → list incomplete runs (`GET /api/runs?status=in_progress`), ask which to resume, replay the apply loop on remaining `applying`/`approved`/`pending` jobs.
- `"retry-failed <run-id>"` → fetch the run; for every `failed` job, PATCH back to `approved`, read `retryNotes`, then replay the apply loop on them.
- Otherwise → search query → Phase 0.

## Phase 0: Existing Run Check + Create

```bash
curl -fsS "$JOBPILOT_API/api/runs?status=in_progress"
```

If a run's `query` matches, ask **"Found an incomplete run from `<startedAt>`. Resume or start fresh?"** Resume → replay the loop.

Otherwise the web UI already created the run row when the user submitted `/runs/new` — confirm it exists and use that `runId`. If invoked manually (rare), create one:

```bash
SLUG=$(echo "<query>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//')
RUN_ID=$(date -u +%Y-%m-%dT%H-%M-%S_${SLUG})
# maxApplications is OPTIONAL — omit the field entirely for unlimited mode.
curl -fsS -X POST "$JOBPILOT_API/api/runs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg id "$RUN_ID" --arg q "<query>" --arg board "<domain>" \
    --argjson minScore <n> \
    '{runId:$id, query:$q, source:"auto-apply", config:{board:$board, minScore:$minScore}}')"
```

Surface live view: `http://localhost:8000/runs/<RUN_ID>`.

## Phase 1: Open the Board (tab 1)

### 1.1 Parse Query

Extract title/role, keywords, location, preferences. If vague, ask before searching.

### 1.2 Search the Chosen Board

Resolve the board:

```bash
curl -fsS "$JOBPILOT_API/api/job-boards" | jq --arg d "<domain>" '.data[] | select(.domain == $d)'
```

If no row matches, PATCH the run to `failed` with `failReason:"Board <domain> not configured"` and stop.

1. `browser_navigate` to `searchUrl` (this is **tab 1** — keep it open for the whole run).
2. Follow `plugin/skills/shared/auth.md` — logs in, and **registers a new account when none exists, without asking**.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `plugin/skills/shared/browser-tips.md`) to read `{ title, company, location, url }` per row.

## Phase 2: Apply Loop (on demand)

Walk the tab-1 results top to bottom. For each result:

### 2.1 Pre-filter (no tab)

Dedupe in-board by normalized title+company. Then check previously-applied:

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `data.applied`, add the job with `status:"skipped"`, `skipReason:"Already applied (<kind>)"` and move on — **don't open a tab.**

### 2.2 Score

If the listing row lacks enough detail, read it from the tab-1 snapshot (don't navigate away). Build the digest and score server-side:

```bash
FIT=$(curl -fsS -X POST "$JOBPILOT_API/api/score-fit" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson digest "$DIGEST" '{digest:$digest}')")
SCORE=$(echo "$FIT" | jq -r '.data.score')
CONF=$(echo "$FIT" | jq -r '.data.confidence')
```

If `CONF >= 0.7` and `SCORE` is ≥10 from `minMatchScore` either side, use it directly; otherwise rescore using `strongMatches`/`partialMatches`/`gaps`. Below `minMatchScore` → add with `status:"skipped"`, `skipReason:"Below minimum match score (X < Y)"` and move on (no tab). Otherwise add it (status `applying`) and apply (2.3):

```bash
DIGEST=<stringified digest>
curl -fsS -X POST "$JOBPILOT_API/api/runs/$RUN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<stable-id>" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<url>" --arg board "<board>" \
    --arg matchReason "<one line>" --argjson score <0-100> --arg digest "$DIGEST" \
    '{jobKey:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"applying", jobDigest:$digest}')"
```

### 2.3 Apply (tab 2)

Open a **second tab** with `browser_tabs` and `browser_navigate` it to the job URL. Tab 1 stays on the results.

1. **Find Apply** — `browser_snapshot` the header, `browser_click` the Apply / Easy Apply control's `ref`. `browser_wait_for`.
2. **Authentication** — if a login/registration wall appears, follow `plugin/skills/shared/auth.md`. On unrecoverable login failure for the domain: POST `/result` `outcome:"failed"`, `failReason:"Login failed for <domain>"`, close tab 2, continue.
3. **Tailor Resume** — invoke the `tailor-resume` skill with `$DIGEST` (empty → fall back to the job URL). Capture the variant id + PDF URL. No usable base → POST `/result` `outcome:"failed"`, `failReason:"No tailorable resume base"`, close tab 2, continue.
4. **Fill Forms** — follow `plugin/skills/shared/form-filling.md`. Upload the tailored variant. Use `autoApply.defaultStartDate`; ask once for salary expectation and remember it for the run.
5. **Submit** — submit autonomously, `browser_wait_for`, then a narrowed `browser_snapshot`: a success confirmation = applied; a populated error on the page = failure with that message as `failReason`.

### 2.4 Record + Close Tab

POST to `/api/runs/$RUN_ID/jobs/<jobKey>/result` (atomically updates RunJob, creates Application on `applied`, marks the queue, recomputes summary):

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# applied
jq -n --arg t "$NOW" --argjson score <0-100> '{outcome:"applied", appliedAt:$t, matchScore:$score}'
# failed (CAPTCHA mid-form, unexpected page, validation, crash)
jq -n --arg r "<reason>" --arg notes "<actionable retry context>" '{outcome:"failed", failReason:$r, retryNotes:$notes}'
```

Then **close tab 2** with `browser_tabs` and select tab 1. Pace 3–5s before the next job.

### 2.5 Stop Conditions

Before picking the next result, refetch the run (`GET /api/runs/<RUN_ID>`):

1. `run.status === "paused"` → user stopped from the UI. POST `/result` `outcome:"skipped"`, `skipReason:"Run paused by user"` for any in-flight `applying` job and exit cleanly.
2. `config.maxApplications` set AND `summary.applied >= config.maxApplications` → end the loop.
3. No more results on tab 1 → scroll / go to the next results page and re-snapshot; if none remain, fall through to Phase 3.

## Phase 3: Summary

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"completed", completedAt:$t}')"
```

Print a summary table, link to `http://localhost:8000/runs/<RUN_ID>`, suggest `retry-failed <RUN_ID>` or a new search.

## Rules

1. **Autonomous after launch.** No per-job or batch confirmation; the UI launch is the approval.
2. **Account handling** — follow `plugin/skills/shared/auth.md`: register when missing (without asking), forgot-password via the `get-code` skill when stale.
3. **Never process payments** — POST `/result` `outcome:"failed"`, `failReason:"Payment required"`.
4. **Email codes** — fetch automatically via the `get-code` skill for `<board-domain>` (see `plugin/skills/shared/auth.md`); only ask the user when it returns nothing. **CAPTCHAs / 2FA** — pause and ask. One-time per board, not per-job failures.
5. **One job per tab.** Board stays in tab 1; each application runs in tab 2, which is closed before the next job.
6. **Deduplicate** within the board and against previously-applied before opening a tab.
7. **Pace** 3–5s between submissions on the same domain.
8. **Audit trail.** PATCH non-terminal transitions; POST `/result` for terminal outcomes.
9. **Respect pause.** Re-read the run between jobs; `status === "paused"` → exit cleanly.
10. **Missing resume file** → PATCH run to `paused`, ask the user to re-upload.
