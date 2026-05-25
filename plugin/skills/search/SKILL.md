---
name: search
description: Search a chosen job board via Playwright, rank results by fit against the user's resume, and save them to the run so the user can review.
argument-hint: "<job_title_keywords_location> --board <domain> [--max-jobs N] [--run <run-id>]"
---

# Job Search

Search a single board (picked by the user when launching the run) and rank results by qualification fit against the resume.

## Setup

1. Follow `plugin/skills/shared/setup.md`.
2. Parse and strip the flags; the rest is the free-text query.
   - `--board <domain>` — **required** (e.g. `--board linkedin.com`).
   - `--max-jobs <N>` — optional cap on results to rank (default 15, max 100).
   - `--run <run-id>` — run to save results to (Step 5). The web UI passes it; if absent, match the latest `source:"search"`, `status:"in_progress"` run on the query, else create one.
3. Resolve the board:

   ```bash
   JOBPILOT_API=http://localhost:8000
   curl -fsS "$JOBPILOT_API/api/job-boards" | jq --arg d "<domain>" '.data[] | select(.domain == $d)'
   ```

   If no row matches, abort with: "Board `<domain>` is not configured. Add it on /boards or run again with a different `--board`." When a `--run` id was given, PATCH it to `failed` with `failReason:"Board <domain> not configured"` first.

## Step 1: Parse Query

Extract title/role, keywords, location, other preferences (e.g. "no startups", "FAANG only", salary). If vague, ask before searching.

## Step 2: Search the Board

1. `browser_navigate` to the resolved board's `searchUrl`.
2. Follow `plugin/skills/shared/auth.md` to log in proactively.
3. Fill the search fields and submit.
4. Take a `browser_snapshot` narrowed to the results list (per `plugin/skills/shared/browser-tips.md`) and read `{ title, company, location, url, postedAt }` per row.
5. Take the first `--max-jobs` results (default 15). If fewer are available, take what's there. Only if a brief description is needed for the ranked table AND the listing preview didn't include one, `browser_navigate` into the posting and `browser_snapshot` its body for the detail. Otherwise skip the per-job nav to save tokens.

## Step 3: Exclude Previously Applied

```bash
URL_ENCODED=$(jq -rn --arg v "<job-url>" '$v|@uri')
TITLE_ENCODED=$(jq -rn --arg v "<title>" '$v|@uri')
COMPANY_ENCODED=$(jq -rn --arg v "<company>" '$v|@uri')
curl -fsS "$JOBPILOT_API/api/applied/check?url=$URL_ENCODED&title=$TITLE_ENCODED&company=$COMPANY_ENCODED"
```

If `data.applied`, tag with "Previously Applied" (note `data.match.kind`: `url` for exact, `fuzzy` with score for title+company). These are saved as `skipped` in Step 5, not offered for apply.

## Step 4: Fit Review

For each non-applied result, score 0–100 based on: tech stack overlap, years vs candidate, education match, domain/industry relevance, seniority alignment.

## Step 5: Save Results to the Run

Save every result as a `RunJob` on `<run-id>` so it appears on the runs detail page. **Don't offer apply/search-again commands** — the user applies from there. Use a stable, shell-safe `jobKey` per result (slug of `company-title` + rank, no spaces).

```bash
curl -fsS -X POST "$JOBPILOT_API/api/runs/<run-id>/jobs" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg key "<jobKey>" --arg title "<title>" --arg company "<company>" \
    --arg location "<location>" --arg url "<job-url>" --arg board "<domain>" \
    --arg matchReason "<one-line verdict>" --argjson score <0-100> \
    '{jobKey:$key, title:$title, company:$company, location:$location, url:$url, board:$board, matchScore:$score, matchReason:$matchReason, status:"pending"}')"
```

Previously-applied results (Step 3) → save with `status:"skipped"`, `skipReason:"Already applied (<kind>)"`. Then close the run:

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/<run-id>" \
  -H 'content-type: application/json' \
  -d "$(jq -n --argjson found <total> --argjson qualified <pending_count> --arg t "$NOW" \
    '{status:"completed", completedAt:$t, summary:{totalFound:$found, qualified:$qualified}}')"
```

## Step 6: Hand Off

Print a compact ranked table, then link to the run — nothing else:

```
## Saved <N> jobs · "[query]" — review and apply at http://localhost:8000/runs/<run-id>

| # | Score | Title | Company | Location |
|---|-------|-------|---------|----------|
```

## Rules

1. **Exactly one board per run** — the `--board` flag is required and the skill targets only that board.
2. **Account handling** — follow `plugin/skills/shared/auth.md`. If login fails because the account doesn't exist, the auth flow registers one with the stored credentials.
3. **Handle rate limiting** — if blocked, note it and continue.
4. **Be honest about scores.** 50/100 is a stretch — label it as such.
5. **Deduplicate** within the board.

Read `plugin/skills/shared/browser-tips.md` for large pages, popups, and browser best practices.
