---
name: auto-apply
description: Search a job board and autonomously apply to matching jobs one at a time, until paused, exhausted, or the max-applications cap is hit.
argument-hint: "<search_query --board <domain> [--min-score N] [--max-apps N]> OR 'resume' OR 'retry-failed <campaign-id>'"
---

# Auto-apply — Search + Apply On Demand

Keep the chosen board open in tab 1; for each result that qualifies, apply in a second tab, then close it and move to the next job. **No batch pre-discovery and no per-job approval — launching the campaign is the confirmation.** Pause only for 2FA / payment. **A CAPTCHA is not a pause** — attempt the `solve-captcha` skill; if unsolved, skip the job (never pause) and the user finishes it later via the `apply` skill. Live view at `http://localhost:8000/campaigns/<campaign-id>`.

## Setup

```bash
JOBPILOT_API="${JOBPILOT_API:-http://localhost:8002}"
```

Follow `../shared/setup.md`. Read `autoApply` (defaults applied per field):

| Setting                 | Default            | Notes                                                                                     |
| ----------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `minMatchScore`         | 60                 | Qualification threshold (0–100). Inline `--min-score` overrides.                          |
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

Otherwise the web UI already created the campaign row when the user submitted `/campaigns/new` — confirm it exists and use that `campaignId`. Capture its selected base resume: `RESUME_ID=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID" | jq -r '.config.resumeId // ""')` (empty → fall back to the primary downstream). If invoked manually (rare), create one:

```bash
SLUG=$(echo "<query>" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/-\+/-/g; s/^-//; s/-$//')
CAMPAIGN_ID=$(date -u +%Y-%m-%dT%H-%M-%S_${SLUG})
# resumeId is REQUIRED for auto-apply — default to the profile's primary.
RESUME_ID=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/profile" | jq -r '.profile.primaryResumeId // ""')
# maxApplications is OPTIONAL — omit the field entirely for unlimited mode.
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

1. `browser_navigate` to `searchUrl` (this is **tab 1** — keep it open for the whole campaign).
2. Follow `../shared/auth.md` — logs in, and **registers a new account when none exists, without asking**.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `../shared/browser-tips.md`) to read `{ title, company, location, url }` per row. This is one viewport — scroll/paginate per **Pagination & infinite scroll** in `../shared/browser-tips.md` as the loop drains rows (see 2.5); never treat the first batch as all jobs.

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

If `.applied`, add the job with `status:"skipped"`, `skipReason:"Already applied (<kind>)"` and move on — **don't open a tab.**

### 2.2 Score

If the listing row lacks enough detail, read it from the tab-1 snapshot (don't navigate away). Build the digest — `{ title, company, techStack[], requirements[], responsibilities[], yearsExperience, descriptionExcerpt }`; always populate `techStack` (it drives the score, empty → low score/confidence) — then score server-side:

```bash
FIT=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/score-fit" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson digest "$DIGEST" --arg rid "$RESUME_ID" \
    '{digest:$digest} + (if $rid=="" then {} else {resumeId:$rid} end)')")
SCORE=$(echo "$FIT" | jq -r '.score')
CONF=$(echo "$FIT" | jq -r '.confidence')
```

If `CONF >= 0.7` and `SCORE` is ≥10 from `minMatchScore` either side, use it directly; otherwise rescore using `strongMatches`/`partialMatches`/`gaps`. A thin/generic row is **not** a skip — read the full posting (tab-1 detail or briefly in tab 2), rebuild the digest, and rescore first. Below `minMatchScore` after a fair read → add with `status:"skipped"`, `skipReason:"Below minimum match score ($SCORE < $MIN_SCORE)"` and move on (no tab). Otherwise add it (status `applying`) and apply (2.3):

```bash
DIGEST=<stringified digest>
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<stable-id>" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<url>" --arg board "<board>" \
    --arg matchReason "<one line>" --argjson score <0-100> --arg digest "$DIGEST" --arg desc "<posting text, when read>" \
    '{key:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"applying", digest:$digest, description:$desc}')"
```

### 2.2a Eligibility — what is (and isn't) a skip

**Valid skip reasons (exact phrasing):**

- `Already applied (<kind>)` — dedupe (2.1).
- `Below minimum match score (X < Y)` — only after reading the actual posting.
- A hard requirement **the JD itself states** the user can't meet, e.g. `US citizenship required`, `Active security clearance required`. Never infer from industry or company name.
- `CAPTCHA — apply manually via the apply skill` / `Payment required` (surface during apply, not scoring).

**Never skip for:** onsite/hybrid/other city when `willingToRelocate` is true or `preferredLocations` is empty/`"Anywhere"` (score on fit, not geography); a sparse JD (read and rescore first); 1099/contractor work; defense/federal industry absent a JD-stated citizenship/clearance requirement; **a role below your level** (Junior/Mid when your résumé is Senior) or one asking fewer years than you have — over-qualification is full marks on experience; judge on tech-stack fit.

### 2.3 Apply (tab 2)

Open a second tab: `browser_tabs(action:"new")`, then `browser_navigate` it to the job URL. Tab 1 stays on the results.

1. **Find Apply** — `browser_snapshot` the header, `browser_click` the Apply / Easy Apply control's `ref`. `browser_wait_for`. If a new tab appeared (ATS portal), `browser_tabs(action:"select", index:<new>)`.
2. **Authentication** — if a login/registration wall appears, follow `../shared/auth.md`. On unrecoverable login failure for the domain: POST `/result` `outcome:"failed"`, `failReason:"Login failed for <domain>"`, close apply tab(s), continue.
3. **CAPTCHA gate** — `browser_snapshot` the apply form _before_ tailoring or filling. If it shows a CAPTCHA (reCAPTCHA / hCaptcha / Turnstile, "I'm not a robot", image/puzzle), invoke the `solve-captcha` skill. **Solved** → continue. **Unsolved** → skip: POST `/result` `outcome:"skipped"`, `skipReason:"CAPTCHA — apply manually via the apply skill"`, close apply tab(s), continue. Checking here avoids wasted tailoring/filling.
4. **Tailor Resume** — invoke the `tailor-resume` skill with `$DIGEST` (empty → fall back to the job URL), passing `--base $RESUME_ID` when set (the campaign's selected resume). Capture the variant id + PDF URL. No usable base → POST `/result` `outcome:"failed"`, `failReason:"No tailorable resume base"`, close apply tab(s), continue.
5. **Fill Forms** — follow `../shared/form-filling.md`. Upload the tailored variant. If the form has a cover-letter field (textarea or file upload), generate one via the `cover-letter` skill with `$DIGEST` (pass `source:auto-apply`) and fill it per form-filling.md (paste text, or upload a generated PDF). Use `autoApply.defaultStartDate`; ask once for salary expectation and remember it for the campaign.
6. **Submit** — submit autonomously, `browser_wait_for`, then a narrowed `browser_snapshot`: a success confirmation = applied; a populated error = failure with that message as `failReason`. A CAPTCHA at this stage → invoke `solve-captcha`; **unsolved** is a skip (2.4), not a failure.

### 2.4 Record + Close Tab

POST to `/api/campaigns/$CAMPAIGN_ID/jobs/<key>/result` (atomically updates the Job, creates Application on `applied`, marks the queue, recomputes summary):

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
# applied
jq -n --arg t "$NOW" --argjson score <0-100> '{outcome:"applied", appliedAt:$t, matchScore:$score}'
# skipped (CAPTCHA appeared — leave for manual apply via the apply skill)
jq -n '{outcome:"skipped", skipReason:"CAPTCHA — apply manually via the apply skill"}'
# failed (unexpected page, validation, crash)
jq -n --arg r "<reason>" --arg notes "<actionable retry context>" '{outcome:"failed", failReason:$r, retryNotes:$notes}'
```

Close all tabs with index ≥ 1: `browser_tabs(action:"close", index:<i>)` descending, then `browser_tabs(action:"select", index:0)`. Pace 3–5s before the next job.

### 2.5 Stop Conditions

The loop ends **only** on one of these. Before picking the next result, refetch the campaign (`GET /api/campaigns/<CAMPAIGN_ID>`):

1. `status === "paused"` → POST `/result` `outcome:"skipped"`, `skipReason:"Campaign paused by user"` for any in-flight `applying` job, exit.
2. `config.maxApplications` set AND `summary.applied >= config.maxApplications` → end. Unset (default) = no cap; keep going.
3. Board exhausted — per **Pagination & infinite scroll** in `../shared/browser-tips.md` (2 consecutive scrolls with no new rows). First batch done ≠ exhausted. With `maxApplications` unset, paginate until genuinely dry.

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
2. **Account handling** — follow `../shared/auth.md`: register when missing (without asking), forgot-password via the `get-code` skill when stale.
3. **Never process payments** — POST `/result` `outcome:"failed"`, `failReason:"Payment required"`.
4. **Email codes** — fetch automatically via the `get-code` skill for `<board-domain>` (see `../shared/auth.md`); only ask the user when it returns nothing. **2FA** — pause and ask (one-time per board). **CAPTCHA** — never pause: detect up front per step 2.3.3, attempt the `solve-captcha` skill, and skip the job for manual apply later only if it returns unsolved.
5. **One job per tab.** Board stays in tab 1; each application runs in tab 2, which is closed before the next job.
6. **Deduplicate** within the board and against previously-applied before opening a tab.
7. **Pace** 3–5s between submissions on the same domain.
8. **Audit trail.** PATCH non-terminal transitions; POST `/result` for terminal outcomes.
9. **Respect pause.** Re-read the campaign between jobs; `status === "paused"` → exit cleanly.
10. **Missing resume file** → PATCH campaign to `paused`, ask the user to re-upload.
11. **Eligibility** — follow 2.2a. Location/onsite, thin JDs, 1099 work, and below-your-level/seniority are never skip reasons; only a JD-stated citizenship/clearance requirement disqualifies.
12. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason` (2.2a). No valid reason → not a skip.
