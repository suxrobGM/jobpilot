---
name: search
description: Search a chosen job board via Playwright, rank results by fit against the user's resume, and save them to the campaign so the user can review.
argument-hint: "<job_title_keywords_location> --board <domain> [--max-jobs N] [--campaign <campaign-id>]"
---

# Job Search

Search a single board (picked by the user when launching the campaign) and rank results by qualification fit against the resume.

## Setup

1. Follow `../../shared/setup.md`.
2. Parse and strip the flags; the rest is the free-text query.
   - `--board <domain>` - **required** (e.g. `--board linkedin.com`).
   - `--max-jobs <N>` - optional cap on results to rank. Absent = unlimited (rank until the board is exhausted).
   - `--campaign <campaign-id>` - campaign to save results to (Phase 5). The web UI passes it; if absent, match the latest `source:"search"`, `status:"in_progress"` campaign on the query, else create one (a `source:"search"` create requires `config.resumeId` - default to the profile's `primaryResumeId`).
3. Resolve the board:

   ```bash
   JOBPILOT_API="${JOBPILOT_API:-https://jobpilot.suxrobgm.net}"
   curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/job-boards" | jq --arg d "<domain>" '.[] | select(.domain == $d)'
   ```

   If no row matches, abort with: "Board `<domain>` is not configured. Add it on /boards or run again with a different `--board`." When a `--campaign` id was given, first command it to `failed` with `POST /api/campaigns/<id>/status {"status":"failed"}`.

## Phase 1: Parse Query

Extract title/role, keywords, location, other preferences (e.g. "no startups", "FAANG only", salary). If vague, ask before searching.

## Phase 2: Search the Board

1. `browser_navigate` to the resolved board's `searchUrl`.
2. Follow `../../shared/auth.md` to log in proactively.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `../../shared/browser-tips.md`) and read `{ title, company, location, url, postedAt }` per row. While under `--max-jobs` (or always, when it's absent/unlimited), scroll/paginate per **Pagination & infinite scroll** in `../../shared/browser-tips.md` until the cap is met or results run dry.
5. Take the first `--max-jobs` results (or all of them when unlimited); if fewer after paginating, take what's there. Only if a brief description is needed for the ranked table AND the listing preview didn't include one, delegate that row to the `job-worker` subagent with `mode:"score"` and `minMatchScore:0` (so nothing is auto-skipped - search keeps every result for review): it opens the posting, scores, and saves the Job row in isolated context, keeping the body out of this conversation. Such rows are already saved - exclude them from the Phase 5 bulk save. Otherwise skip the per-job nav and rank from the row to save tokens.

## Phase 3: Exclude Previously Applied

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `.applied`, tag with "Previously Applied" (note `.match.kind`: `url` for exact, `fuzzy` with score for title+company). In Phase 5, create these rows as `pending`, then record `skipped` through `/jobs/<key>/result`; do not offer them for apply.

## Phase 4: Fit Review

Score against the campaign's `config.resumeId` when set (`GET /api/resumes/<id>` for its content), else the primary (from setup). For each non-applied result, score 0-100 based on: tech stack overlap, years vs candidate, education match, domain/industry relevance, seniority alignment.

## Phase 5: Save Results to the Campaign

Save every result as a `Job` on `<campaign-id>` so it appears on the campaigns detail page. **Don't offer apply/search-again commands** - the user applies from there. Use a stable, shell-safe `key` per result (slug of `company-title` + rank, no spaces).

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<key>" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<job-url>" --arg board "<domain>" \
    --arg matchReason "<one-line verdict>" --argjson score <0-100> \
    '{key:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"pending"}')"
```

Previously-applied results (Phase 3) → create as `pending`, then POST `/jobs/<key>/result` with `{outcome:"skipped",skipReason:"Already applied (<kind>)"}`. Then close the campaign:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/<campaign-id>/status" \
  -H 'content-type: application/json' \
  -d '{"status":"completed"}'
```

## Phase 6: Hand Off

Print a compact ranked table, then link to the campaign - nothing else:

```
## Saved <N> jobs · "[query]" - review and apply at $JOBPILOT_WEB/campaigns/<campaign-id>

| # | Score | Title | Company | Location |
|---|-------|-------|---------|----------|
```

## Rules

1. **Exactly one board per campaign** - the `--board` flag is required and the skill targets only that board.
2. **Account handling** - follow `../../shared/auth.md`. If login fails because the account doesn't exist, the auth flow registers one with the stored credentials.
3. **Handle rate limiting** - if blocked, note it and continue.
4. **Be honest about scores.** 50/100 is a stretch - label it as such.
5. **Deduplicate** within the board.

Read `../../shared/browser-tips.md` for large pages, popups, and browser best practices.
