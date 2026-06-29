---
name: auto-apply
description: Search a job board and autonomously apply to matching jobs one at a time, until paused, exhausted, or the max-applications cap is hit.
argument-hint: "<search_query --board <domain> [--min-score N] [--max-apps N]> OR 'resume' OR 'retry-failed <campaign-id>'"
---

# Auto-apply - Search + Apply On Demand

Keep the chosen board open in tab 1; for each result that qualifies, delegate the application to the `job-worker` subagent (it works in its own tab and returns a compact result), then move to the next job. **No batch pre-discovery and no per-job approval - launching the campaign is the confirmation.** Pause only for 2FA / payment. **A CAPTCHA is not a pause** - attempt the `solve-captcha` skill; if unsolved, skip the job (never pause) and the user finishes it later via the `apply` skill. Live view at `http://localhost:8000/campaigns/<campaign-id>`.

## Setup

```bash
JOBPILOT_API="${JOBPILOT_API:-http://localhost:8002}"
```

Follow `../shared/setup.md`. Read `autoApply` (defaults applied per field):

| Setting                 | Default            | Notes                                                                                     |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `minMatchScore`         | 60                 | Qualification threshold (0-100). Inline `--min-score` overrides.                          |
| `maxApplicationsPerCampaign` | `null` (unlimited) | Stop after this many successful applies. Inline `--max-apps` overrides; omit → unlimited. |
| `defaultStartDate`      | `"2 weeks notice"` | Default start-date answer.                                                                |

Inline argument overrides take precedence. `--board <domain>` is **required** unless the argument is `resume` or `retry-failed <campaign-id>`.

### Campaign Modes

- `"resume"` → list incomplete campaigns (`GET /api/campaigns?status=in_progress`), ask which to resume, replay the apply loop on remaining `applying`/`approved`/`pending` jobs.
- `"retry-failed <campaign-id>"` → fetch the campaign; for every `failed` job, PATCH back to `approved`, read `retryNotes`, then replay the apply loop on them.
- Otherwise → search query → Phase 0.

To recover wrongly-`skipped` jobs, use the dedicated `rescan-skipped` skill (it re-scores and promotes to `approved`; apply them afterward).

## Phase 0: Existing Campaign Check + Create

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns?status=in_progress"
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns?status=paused"
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns?status=interrupted"
```

If any matches, ask **"Found an incomplete campaign from `<startedAt>` (status: `<status>`). Resume or start fresh?"** Resume → inject the `resume` skill with that `campaignId`.

Otherwise the web UI already created the campaign row when the user submitted `/campaigns/new` - confirm it exists and use that `campaignId`. Capture its selected base resume: `RESUME_ID=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID" | jq -r '.config.resumeId // ""')` (empty → fall back to the primary downstream). If invoked manually (rare), create one:

```bash
SLUG=$(echo "<query>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//')
CAMPAIGN_ID=$(date -u +%Y-%m-%dT%H-%M-%S_${SLUG})
# resumeId is REQUIRED for auto-apply - default to the profile's primary.
RESUME_ID=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/profile" | jq -r '.profile.primaryResumeId // ""')
# maxApplications is OPTIONAL - omit the field entirely for unlimited mode.
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg id "$CAMPAIGN_ID" --arg q "<query>" --arg board "<domain>" --arg rid "$RESUME_ID" \
    --argjson minScore <n> \
    '{campaignId:$id, query:$q, source:"auto-apply", config:{board:$board, resumeId:$rid, minScore:$minScore}}')"
```

Surface live view: `http://localhost:8000/campaigns/<CAMPAIGN_ID>`.

## Phase 1: Open the Board (tab 1)

### 1.1 Parse Query

Extract title/role, keywords, location, preferences. If vague, ask before searching.

### 1.2 Search the Chosen Board

Resolve the board:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/job-boards" | jq --arg d "<domain>" '.[] | select(.domain == $d)'
```

If no row matches, PATCH the campaign to `failed` with `failReason:"Board <domain> not configured"` and stop.

1. `browser_navigate` to `searchUrl` (this is **tab 1** - keep it open for the whole campaign).
2. Follow `../shared/auth.md` - logs in, and **registers a new account when none exists, without asking**.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `../shared/browser-tips.md`) to read `{ title, company, location, url }` per row. This is one viewport - scroll/paginate per **Pagination & infinite scroll** in `../shared/browser-tips.md` as the loop drains rows (see 2.5); never treat the first batch as all jobs.

## Phase 2: Apply Loop (on demand)

Walk the tab-1 results top to bottom; at the last loaded row, scroll/page for more (1.2 step 4) before concluding. For each result:

### 2.1 Pre-filter (no tab)

Dedupe in-board by normalized title+company. Then check previously-applied:

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `.applied`, add the job with `status:"skipped"`, `skipReason:"Already applied (<kind>)"` and move on - **don't open a tab.**

### 2.2 Score

If the listing row lacks enough detail, read it from the tab-1 snapshot (don't navigate away). Build the digest (`../shared/digest-schema.md`), then score server-side:

```bash
FIT=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/score-fit" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson digest "$DIGEST" --arg rid "$RESUME_ID" \
    '{digest:$digest} + (if $rid=="" then {} else {resumeId:$rid} end)')")
SCORE=$(echo "$FIT" | jq -r '.score')
CONF=$(echo "$FIT" | jq -r '.confidence')
```

If `CONF >= 0.7` and `SCORE` is ≥10 from `minMatchScore` either side, use it directly; otherwise rescore using `strongMatches`/`partialMatches`/`gaps`. A thin/generic row is **not** a skip - read the full posting (from the tab-1 detail, or open it briefly if truly needed), rebuild the digest, and rescore first. Below `minMatchScore` after a fair read → add with `status:"skipped"`, `skipReason:"Below minimum match score ($SCORE < $MIN_SCORE)"` and move on (no tab). Otherwise add it (status `applying`) and apply (2.3):

```bash
DIGEST=<stringified digest>
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<stable-id>" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<url>" --arg board "<board>" \
    --arg matchReason "<one line>" --argjson score <0-100> --arg digest "$DIGEST" --arg desc "<posting text, when read>" \
    '{key:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"applying", digest:$digest, description:$desc}')"
```

### 2.2a Eligibility - what is (and isn't) a skip

Follow `../shared/eligibility.md`.

### 2.3 Apply (delegate to `job-worker`)

Hand the job to the `job-worker` subagent and wait for its compact result. It opens its own tab and runs auth, CAPTCHA, tailoring, form-fill, and submit in isolated context, so the form/posting snapshots never enter this conversation. **One worker at a time** - the browser is shared; never delegate the next job until this one returns.

Delegate with input JSON:

```json
{ "mode": "apply", "campaignId": "<CAMPAIGN_ID>", "jobKey": "<key>", "url": "<job-url>",
  "board": "<domain>", "digest": <DIGEST>, "resumeId": "<RESUME_ID>",
  "defaultStartDate": "<autoApply.defaultStartDate>", "salaryExpectation": <remembered-or-null>,
  "preSubmitReview": false }
```

It returns one of `applied` / `failed` / `skipped` / `needs_user` - handle in 2.4.

### 2.4 Record + Continue

The worker already closed its apply tab(s); re-select tab 0. Map its `outcome` to a terminal write - POST `/api/campaigns/$CAMPAIGN_ID/jobs/<key>/result` (atomically updates the Job, creates the Application on `applied`, marks the queue, recomputes the summary):

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# applied
jq -n --arg t "$NOW" --argjson score <0-100> '{outcome:"applied", appliedAt:$t, matchScore:$score}'
# skipped (e.g. CAPTCHA - leave for manual apply via the apply skill)
jq -n --arg r "<skipReason>" '{outcome:"skipped", skipReason:$r}'
# failed (login failure, unexpected page, validation, crash)
jq -n --arg r "<failReason>" --arg notes "<retryNotes>" '{outcome:"failed", failReason:$r, retryNotes:$notes}'
```

`needs_user`:

- `reason:"salary"` → ask the user once, remember the answer for the campaign, and re-delegate 2.3 with `salaryExpectation` set.
- `reason:"2FA"` → PATCH the campaign `paused`, tell the user what's needed, and exit the loop (the worker left its tab open).
- `reason:"payment"` → never pay: POST `/result` `outcome:"failed"`, `failReason:"Payment required"`, and continue.

Pace 3-5s before the next result.

### 2.5 Stop Conditions

The loop ends **only** on one of these. Before picking the next result, refetch the campaign (`GET /api/campaigns/<CAMPAIGN_ID>`):

1. `status === "paused"` → POST `/result` `outcome:"skipped"`, `skipReason:"Campaign paused by user"` for any in-flight `applying` job, exit.
2. `config.maxApplications` set AND `summary.applied >= config.maxApplications` → end. Unset (default) = no cap; keep going.
3. Board exhausted - per **Pagination & infinite scroll** in `../shared/browser-tips.md` (2 consecutive scrolls with no new rows). First batch done ≠ exhausted. With `maxApplications` unset, paginate until genuinely dry.

## Phase 3: Summary

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"completed", completedAt:$t}')"
```

Print a summary table, link to `http://localhost:8000/campaigns/<CAMPAIGN_ID>`, suggest `retry-failed <CAMPAIGN_ID>`, the `rescan-skipped` skill on `<CAMPAIGN_ID>` to recover dropped jobs, or a new search.

## Rules

1. **Autonomous after launch.** No per-job or batch confirmation; the UI launch is the approval.
2. **Account handling** - follow `../shared/auth.md`: register when missing (without asking), forgot-password via the `get-code` skill when stale.
3. **Never process payments** - POST `/result` `outcome:"failed"`, `failReason:"Payment required"`.
4. **Email codes** - fetch automatically via the `get-code` skill for `<board-domain>` (see `../shared/auth.md`); only ask the user when it returns nothing. **2FA** - the worker returns `needs_user reason:"2FA"`; pause and ask (one-time per board). **CAPTCHA** - never pause: the `job-worker` detects it up front and attempts `solve-captcha`; an unsolved CAPTCHA comes back as a `skipped` outcome (manual apply later), never a pause.
5. **One job per worker.** Board stays in tab 1; each application runs in the `job-worker`'s own tab, which it closes before returning. Delegate sequentially - one worker at a time (shared browser).
6. **Deduplicate** within the board and against previously-applied before opening a tab.
7. **Pace** 3-5s between submissions on the same domain.
8. **Audit trail.** PATCH non-terminal transitions; POST `/result` for terminal outcomes.
9. **Respect pause.** Re-read the campaign between jobs; `status === "paused"` → exit cleanly.
10. **Missing resume file** → PATCH campaign to `paused`, ask the user to re-upload.
11. **Eligibility** - follow 2.2a. Location/onsite, thin JDs, 1099 work, and below-your-level/seniority are never skip reasons; only a JD-stated citizenship/clearance requirement disqualifies.
12. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason` (2.2a). No valid reason → not a skip.
