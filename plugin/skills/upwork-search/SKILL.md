---
name: upwork-search
description: Search Upwork through the official Upwork MCP, filter out low-quality clients, rank the rest by fit, and save them to the user's Upwork feed as recommendations. Never submits a proposal.
argument-hint: "<job_keywords> --board upwork.com [--max-jobs N]"
---

# Upwork search

Find Upwork jobs the user can win, judged on fit and client quality, and save them to the Upwork
feed. Recommend only: the user drafts with `upwork-proposal` and sends with `upwork-submit`.

## Setup

1. Follow `../_shared/setup.md` and `../_shared/upwork-mcp.md` (connection check, `org_uid`).
2. Strip the flags; the rest is the query. `--board upwork.com` is required. `--max-jobs N`: how
   many results to evaluate, default 30.
3. `GET /api/job-boards` must list `upwork.com`, else stop with "Upwork is not configured. Add it
   on the Job boards page."
4. Get the Upwork feed and read `.id` as `FEED_ID`:

   ```bash
   jobpilot-api POST /api/feeds --data '{"kind":"upwork"}'
   ```

## 1. Search

From the query take the role, skills and the preferences Upwork can filter: hourly or fixed,
budget or rate floor, client location, weekly hours, length. Ask first if it is vague. Put every
preference into the search filters, plus `verified_payment_only: true` and `proposals_max: 49`
(both would be hard skips later).

Two sources, merged and deduped on job id, splitting `--max-jobs` between them:

1. `find_jobs` `smart_search`, `mode: "best_match"`, filters only (it already knows the profile).
   Add `days_posted` when the user wants fresh work.
2. `find_jobs` `search`: `title` (1-3 words) when the user named a role, else `query`. Leave `sort`
   unset: `relevance` silently drops `title`, `skills` and `category`.

Page with the cursor, same filters, while `hasNextPage` / `hasMore`. `location` takes a country or
region name; zero results may mean an unknown spelling, so read `empty_result_note` and retry with
the one it names. Drop rows with `applied` or `is_applied` true.

## 2. Each job

1. **Applied check** (`../_shared/feed-flow.md`), with the client name as the company.
2. **Client quality**, from the search row alone:

   ```bash
   jobpilot-api POST /api/upwork/client-scores --data '{"client":{"paymentVerified":true,"totalSpent":12000,"rating":4.9,"reviewsCount":24,"proposalsCount":7,"postedHoursAgo":6,"jobType":"hourly"}}'
   ```

   Sources: `verification_status`, `total_spent`, `total_reviews`, `proposal_count`, and hours
   since `created_date` or `published_date`. Omit what you can't read; a missing field counts as
   neutral. `rating` is what freelancers gave this client. Keep the object as `CLIENT`.
   `verdict: "skip"`: create the job as `pending`, post its result with the response's
   `skipReason`, and move on without opening the posting.
3. **Posting**: `find_jobs` `get` with the row's numeric `id`. Keep the description,
   `client_record` and `connects_cost`; drop the rest. Add `clientHires` from `client_record` to
   `CLIENT` and score the client again: this verdict and its `qualityScore` are the ones that
   count. `skip`: as above.
4. **Fit**: build the brief (`../_shared/job-brief.md`) from the description and `POST
   /api/fit-scores` `{brief, minScore}` via `$JOBPILOT_TEMP/fit.json`. `verdict` `trust`: use
   `score`; otherwise reason from `strongMatches`, `partialMatches` and `gaps`. Below-level,
   sparse or contract work is never a skip (`../_shared/eligibility.md`).
5. **Save**. The brief also carries `clientStats` (`CLIENT`), `qualityScore` and `connectsCost`, so
   the card can show them. Write `$JOBPILOT_TEMP/job.json`:

   ```json
   { "key": "<client-title slug>", "title": "", "company": "<clientName>", "url": "<row url>",
     "board": "upwork.com", "matchScore": 0, "matchReason": "Fit <score>, <client flags>",
     "status": "pending", "brief": "<brief as a JSON string>", "description": "<description>" }
   ```

   ```bash
   jobpilot-api POST /api/feeds/$FEED_ID/jobs --data @"$JOBPILOT_TEMP/job.json"
   ```

Skip only on a client `skip` verdict, an applied match, or a stated hard requirement.

## 3. Hand off

A compact ranked table and `$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`, nothing else. Never call
`manage_proposals` here.
