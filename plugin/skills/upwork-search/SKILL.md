---
name: upwork-search
description: Search Upwork via Playwright, smart-filter out low-quality and unresponsive clients, rank survivors by fit, and save them to the campaign as recommendations. Never submits a proposal.
argument-hint: "<job_keywords> --board upwork.com [--max-jobs N] [--campaign <campaign-id>]"
---

# Upwork Job Search & Recommend

Find Upwork jobs the user can win - qualify on fit **and** client quality, drop the junk, and save the keepers to the campaign for review. **Recommend only: never submit a proposal and never spend connects.** The user drafts a proposal (the `upwork-proposal` skill, launched per job from the campaign page) and submits manually.

## Setup

1. Follow `../../shared/setup.md`. ``$JOBPILOT_API` (injected by the terminal)`.
2. Parse and strip the flags; the rest is the free-text query.
   - `--board upwork.com` - required.
   - `--max-jobs <N>` - cap on results to evaluate. Absent = unlimited (evaluate until results run dry).
   - `--campaign <id>` - campaign to save to. The UI passes it; if absent, match the latest `source:"search"`, `status:"in_progress"` campaign on the query, else create one (a `source:"search"` create requires `config.resumeId` - default to the profile's `primaryResumeId`).
3. Resolve the board: `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/job-boards" | jq '.[] | select(.domain=="upwork.com")'`. No row → abort: "Upwork is not configured. Add it on /boards." If a `--campaign` was given, first command it to `failed` with `POST /api/campaigns/<id>/status {"status":"failed"}`.

## Phase 1: Parse Query

Extract role/skills, keywords, and preferences (hourly vs fixed, budget floor, client country). If vague, ask before searching.

## Phase 2: Search Upwork

1. `browser_navigate` to the board's `searchUrl`.
2. Follow `../../shared/auth.md` to log in proactively (resolve via `/api/credentials/resolve?domain=upwork.com`).
3. Enter the query; apply available filters (e.g. payment-verified, fewer-than-N proposals) to cut junk early.
4. **Run two passes - the user is US-based and eligible for both:**
   - **Global** - the default feed (jobs open to any location).
   - **U.S.-only** - set the location filter to United States (`?location=United%20States`, or the "Client location / Talent located in" → United States filter). Upwork hides US-resident-restricted postings behind this filter, so a global-only search misses them.
   - Treat the combined results as one pool; split `--max-jobs` across the passes (don't double-count). U.S.-only is a bonus segment - never skip a job for being U.S.-restricted.
5. `browser_snapshot` narrowed to the results list (`../../shared/browser-tips.md`); read `{ title, clientName, url, snippet }` per card.

## Phase 3: Evaluate Each Result

### 3.1 Dedupe

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<clientName>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

`.applied` → create the row as `pending`, POST `/jobs/<key>/result` with `{outcome:"skipped",skipReason:"Already applied (<kind>)"}`, then skip the rest.

### 3.2 Client quality (smart filter)

Read the card + client panel for the signals below (omit any you can't see - every field is optional). Then score server-side:

```bash
CLIENT='{ "paymentVerified": true, "hireRate": 80, "totalSpent": 12000, "rating": 4.9,
  "reviewsCount": 24, "proposalsBucket": "5-10", "postedHoursAgo": 6, "jobType": "hourly" }'
QUALITY=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/upwork/client-quality" \
  -H 'content-type: application/json' -d "$(jq -n --argjson c "$CLIENT" '{client:$c}')")
VERDICT=$(echo "$QUALITY" | jq -r '.verdict')   # good | caution | skip
```

`proposalsBucket` is one of `<5 | 5-10 | 10-15 | 15-20 | 20-50 | 50+`. The scorer hard-skips unverified payment, 50+ proposals (saturated), low hire-rate-but-many-jobs (unresponsive), and unproven+unverified clients. If `VERDICT == "skip"`, create the Job as `pending`, record `.skipReason` through `/jobs/<key>/result`, and move on - don't score fit.

### 3.3 Fit

Build the digest (`../../shared/digest-schema.md`); always populate `techStack`. The client signals belong in the saved digest - keep them as `EXTRA='{ "clientStats": <CLIENT>, "qualityScore": <quality score> }'`.

**Thin card** (you'd need the full posting): delegate to `job-worker mode:"score"` instead - it opens the posting, scores, and **saves the Job row itself** (full JD in `description`) in isolated context, so the posting body never enters this conversation. Pass `EXTRA` as `extraDigest`; use the returned `{matchScore, eligible}` for the table and **skip 3.4**:

```json
{ "mode": "score", "campaignId": "<campaign-id>", "jobKey": "<company-title-rank slug>",
  "url": "<job-url>", "board": "upwork.com", "minMatchScore": <minScore>, "resumeId": "<RESUME_ID>",
  "extraDigest": <EXTRA> }
```

One worker at a time. **Rich card** (the snippet is enough): score inline and save in 3.4:

```bash
FIT=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/score-fit" \
  -H 'content-type: application/json' -d "$(jq -n --argjson d "$DIGEST" '{digest:$d}')")
SCORE=$(echo "$FIT" | jq -r '.score')
```

Use it directly when `confidence >= 0.7`; otherwise rescore from `strongMatches`/`partialMatches`/`gaps`. A thin or below-level posting is **not** a skip - judge on tech fit (`../../shared/eligibility.md`).

### 3.4 Save the recommendation (rich-card path only)

The thin-card path already saved via the worker - skip to the next result. For a rich card, stash the client signals + quality score into the digest so the campaign card can show them and `rescan-skipped` can re-evaluate. Save the JD text into `description` so "Draft proposal" can seed the proposal later.

```bash
DIGEST_FULL=$(jq -n --argjson fit "$DIGEST" --argjson client "$CLIENT" --argjson q "$QUALITY" \
  '$fit + {clientStats:$client, qualityScore:($q.qualityScore)}')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<company-title-rank slug>" --arg title "<title>" --arg company "<clientName>" \
    --arg url "<job-url>" --arg matchReason "Fit $SCORE · $(echo "$QUALITY" | jq -r '.flags|join(", ")')" \
    --argjson score "$SCORE" --arg digest "$(echo "$DIGEST_FULL" | jq -c .)" --arg desc "<full JD>" \
    '{key:$key, title:$title, company:$company, url:$url, board:"upwork.com", matchScore:$score, matchReason:$matchReason, status:"pending", digest:$digest, description:$desc}')"
```

## Phase 4: Close & Hand Off

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/status" \
  -H 'content-type: application/json' -d '{"status":"completed"}'
```

Print a compact ranked table and link to `$JOBPILOT_WEB/campaigns/<campaign-id>` - nothing else. The user reviews, hits **Draft proposal** on the ones they want, and applies on Upwork.

## Rules

1. **Recommend only.** Never click Submit/Apply, never spend connects. Generating a proposal is a separate, user-triggered step.
2. **Smart filter, not blanket skip.** Drop only on a client-quality `skip` verdict, an applied dupe, or a JD-stated hard requirement. Below-level/thin-JD/contractor are never skips - that's the whole point of Upwork.
3. **Account handling** - `../../shared/auth.md` (register if missing, forgot-password via `get-code`).
4. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason`.
5. **Be honest about scores.** Label stretches as stretches.

Read `../../shared/browser-tips.md` for large pages, Cloudflare/login walls, and snapshot best practices.
