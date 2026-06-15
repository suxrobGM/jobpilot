---
name: apply
description: Apply to a single job (URL or pasted page) with fit review, or drain the pending queue when no argument is given.
argument-hint: "[job_url_or_pasted_job_page] (omit to drain the queue)"
---

# Apply — Single Job or Batch Queue

Two modes, one shared apply loop:

- **Single-job** (argument is a URL or pasted job page): fit review → user "yes" → apply one.
- **Batch** (no argument): drain `/api/queue/pending` → score → ranked table approval → apply all.

User approves once up front. No per-job confirmation after that.

## Setup

Follow `../shared/setup.md` to load profile, resume, credentials.

```bash
JOBPILOT_API="${JOBPILOT_API:-http://localhost:8002}"
```

Read `autoApply` for config (defaults applied per field):

| Setting                 | Default            | Notes                                                                                            |
| ----------------------- | ------------------ | ------------------------------------------------------------------------------------------------ |
| `minMatchScore`         | 70                 | Batch-mode threshold (0–100). Ignored in single-job mode.                                        |
| `maxApplicationsPerCampaign` | `null` (unlimited) | Sent as `config.maxApplications` when set; omit for unlimited batch. Single-job mode forces `1`. |
| `defaultStartDate`      | `"2 weeks notice"` | Default start-date answer.                                                                       |

For ATS portals (Greenhouse, Lever, Workday, etc.) the apply step lands on a domain that isn't in `/api/job-boards`. Follow `../shared/auth.md` — credentials are resolved from the `Credential.scope === <domain>` row or the `scope === "default"` fallback. The auth flow **registers a new account when none exists** (no asking) and runs forgot-password if the stored password is stale.

## Phase 0: Dispatch

- Argument is `campaign <campaign-id>` → **re-apply mode**: set `CAMPAIGN_ID=<campaign-id>`, set `config.maxApplications = null` (unlimited — the user hand-selected these jobs), skip Phases 1–3, and run the Phase 4 loop over its current `approved` jobs. (The campaign viewer — or the `rescan-skipped` skill — promotes the chosen skipped/failed jobs to `approved` before injecting this.)
- Any other argument present → **Phase 1A** (single-job).
- No argument → **Phase 1B** (batch).

---

## Phase 1A: Single-Job Mode

If the argument is pasted content (HTML / text), extract description, Apply URL, company, title. If no Apply URL can be found, stop: **"I need either a job URL or content with a visible Apply link."**

### 1A.1 Fit Review

URL input → `browser_navigate`, then take a `browser_snapshot` narrowed to the posting body (per `../shared/browser-tips.md`) and build the digest JSON (`title`, `company`, `location`, `salary`, `employmentType`, `remote`, `requirements`, `responsibilities`, `techStack`, `yearsExperience`, `descriptionExcerpt`) from it. Pasted input → parse the same fields manually. Keep the digest in `DIGEST=...` for 1A.4.

```
## Job Fit Review: [Title] at [Company]

**Match Score: X/100**

**Strong Matches:** [skill — evidence]
**Partial Matches:** [skill — what's adjacent]
**Gaps:** [skill — what's missing]
**Visa/Sponsorship Risk:** [if mentioned]
**Verdict:** [1-2 sentence recommendation]
```

Ask: **"Want me to proceed with the application?"** — `yes`/`go` continue, anything else stop.

### 1A.2 Dedupe Check

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `data.applied === true`, surface the match (title + company + appliedAt + `data.match.kind`) and ask whether to proceed anyway. Stop on no.

### 1A.3 Create Campaign-of-1

```bash
CAMPAIGN_ID=$(date -u +%Y-%m-%dT%H-%M-%S_apply)
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg campaignId "$CAMPAIGN_ID" --arg query "<title> at <company>" \
    '{campaignId:$campaignId, query:$query, source:"apply", config:{maxApplications:1}}')"
```

### 1A.4 Add the Job

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

Keep `$CAMPAIGN_ID` and `$JOB_KEY`. Live view: `http://localhost:8000/campaigns/<CAMPAIGN_ID>`. Jump to **Phase 4**.

---

## Phase 1B: Batch Mode

### 1B.1 Pull Queue

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/queue/pending"
```

`data` is `[{ id, url, note, status }]`. If empty, tell user to open `http://localhost:8000/queue` to add URLs and stop. Otherwise: **"Found N URLs in the queue. Visiting each to gather details..."**

### 1B.2 Create Campaign

```bash
CAMPAIGN_ID=$(date -u +%Y-%m-%dT%H-%M-%S_apply)
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg campaignId "$CAMPAIGN_ID" \
    '{campaignId:$campaignId, query:"apply queue", source:"apply", config:{minScore:6, maxApplications:10}}')"
```

## Phase 2: Visit and Score (Batch Only)

For each queue URL:

### 2.1 Pre-dedupe

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED"
```

If applied, mark the queue entry consumed (`status:"skipped"`) and add a skipped Job with `skipReason:"Already applied (<kind>)"`, then continue.

### 2.2 Visit + Extract

1. `browser_navigate` to the URL.
2. Take a `browser_snapshot` narrowed to the posting body (per `../shared/browser-tips.md`) and build the digest JSON from it. Keep the stringified digest as `DIGEST` for 2.3.
3. If login is needed, follow `../shared/auth.md`, then re-read the posting.
4. Re-run `/api/applied/check` with title+company for fuzzy match.

### 2.3 Score and Add

Pre-score server-side; deliberate only on borderline cases. Always populate the digest's `techStack` — it drives the score (empty → low score/confidence).

```bash
FIT=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/score-fit" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson digest "$DIGEST" '{digest:$digest}')")
SCORE=$(echo "$FIT" | jq -r '.score')
CONF=$(echo "$FIT" | jq -r '.confidence')
```

If `CONF >= 0.7` and `SCORE` is at least 10 from threshold either side, use it directly. Otherwise rescore from the digest using `strongMatches`/`partialMatches`/`gaps` in `FIT`.

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<entry-id>" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<job-url>" --arg board "<board>" \
    --arg matchReason "<one line>" --argjson score <0-100> \
    --arg digest "$DIGEST" --arg desc "<posting text>" \
    '{key:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"pending", digest:$digest, description:$desc}')"
```

If `score < minMatchScore`, immediately PATCH to `skipped` with `skipReason:"Below minimum match score (X < Y)"`.

**Eligibility** (same as `auto-apply` 2.2a): never skip for onsite/other-city when `willingToRelocate` is true or `preferredLocations` is empty/`"Anywhere"`, for a thin JD (read and rescore first), for 1099/defense/federal work, or for a role below your level/seniority (over-qualification scores full marks on experience) — only a JD-stated citizenship/clearance requirement disqualifies.

## Phase 3: Batch Confirmation (Batch Only)

**Auto mode** (`confirmMode: "auto"` AND every qualified job ≥ threshold): PATCH all to `approved`, go to Phase 4.

**Batch mode** (default): present ranked table.

```
## Batch Apply

Visited <total> jobs. <qualified> qualify (score >= minMatchScore/100).

| # | Score  | Title | Company | Location | Board |
|---|--------|-------|---------|----------|-------|

**Commands:** "go" | "go 1,3,5" | "remove 3" | "details 2" | "stop"
```

PATCH `Job.status` accordingly:

- `go` → all qualified to `approved`
- `go N,M` → selected to `approved`; rest to `skipped` (`"Not selected by user"`)
- `remove N` → that job to `skipped` (`"Removed by user"`); re-present table
- `stop` → PATCH campaign `status:"paused"` and stop

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs/<key>" \
  -H 'content-type: application/json' -d '{"status":"approved"}'
```

## Phase 4: Apply Loop

For each `approved` job, score-descending:

### 4.1 Mark Applying

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs/<key>" \
  -H 'content-type: application/json' -d '{"status":"applying"}'
```

### 4.2 Navigate + Find Apply

Navigate to the job URL. `browser_snapshot` the header, `browser_click` the Apply / Easy Apply control's `ref`. `browser_wait_for`. If a new tab appeared (ATS portal), `browser_tabs(action:"select", index:<new>)`. `browser_snapshot` the form to enumerate fields and refs. If a login page appears, follow `../shared/auth.md`.

### 4.3 Tailor Resume

```bash
DIGEST=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs" | jq -r --arg key "<key>" '.[] | select(.key == $key) | .digest // empty')
```

Invoke the `tailor-resume` skill with `$DIGEST`. Empty `$DIGEST` (legacy row) → fall back to the job URL. Capture the variant id + PDF URL for 4.4. If no usable base → POST `/result` `outcome:"failed"`, `failReason:"No tailorable resume base"`.

### 4.4 Fill Forms

Follow `../shared/form-filling.md`. Upload the 4.3 variant for resume fields. If the form has a cover-letter field (textarea or file upload), generate one via the `cover-letter` skill with `$DIGEST` (pass `source:apply`) and fill it per form-filling.md (paste text, or upload a generated PDF). Use `autoApply.defaultStartDate`; ask once for salary expectation if a field needs it.

### 4.5 Pre-Submit Review (Single-Job Mode Only)

Skip in batch mode. When `config.maxApplications === 1`, re-snapshot the form and present:

```
## Ready to Submit: [Title] at [Company]
| Name | Email | Phone | Resume | Salary | Start date | Cover letter | Custom Qs |
<total> fields across <P> page(s). Submit? (yes / no / edit <field>)
```

`no` → POST `/result` with `outcome:"skipped"`, `skipReason:"User cancelled at pre-submit review"`. `edit <field>` → fix, re-snapshot, re-present.

### 4.6 Submit

Click submit, `browser_wait_for`, then take a narrowed `browser_snapshot` for the result. A success confirmation = applied; a populated error message on the page = failure with that message as `failReason`.

### 4.7 Record Result

POST one of three outcomes to `/api/campaigns/$CAMPAIGN_ID/jobs/<key>/result`. The server atomically updates the Job, creates Application (on `applied`), marks the queue, and recomputes summary.

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# applied
jq -n --arg t "$NOW" --argjson score <0-100> '{outcome:"applied", appliedAt:$t, matchScore:$score}'
# failed
jq -n --arg r "<reason>" --arg notes "<actionable retry notes>" '{outcome:"failed", failReason:$r, retryNotes:$notes}'
# skipped (e.g., user cancelled, max-apps cap)
jq -n --arg r "<reason>" '{outcome:"skipped", skipReason:$r}'
```

Close any tabs with index ≥ 1: `browser_tabs(action:"close", index:<i>)` descending, then `browser_tabs(action:"select", index:0)`. Continue to next job.

### 4.8 Limit

If `config.maxApplications` is set and `applied >= config.maxApplications`, stop the loop. Leave remaining `approved` jobs as-is.

## Phase 5: Summary

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"completed", completedAt:$t}')"
```

Print a summary table and link to `http://localhost:8000/campaigns/<CAMPAIGN_ID>`.

## Rules

1. **Up-front confirmation mandatory** (1A.1 or Phase 3); single-job mode adds pre-submit review (4.5).
2. **Create accounts when needed** — follow `../shared/auth.md`: register when no account exists (without asking), run forgot-password when the stored password is stale.
3. **Never process payments** — POST `/result` `outcome:"failed"`, `failReason:"Payment required"`.
4. **CAPTCHAs / email verification** — for a CAPTCHA, invoke the `solve-captcha` skill; if it returns **unsolved**, pause and ask (see `../shared/auth.md`). Email verification → pause and ask.
5. **Be honest about match scores.**
6. **Pace** 3–5s between submissions on the same domain.
7. **The Campaign is the audit trail.** PATCH non-terminal transitions; POST `/result` for terminal outcomes.
8. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason`. No valid reason → not a skip.
