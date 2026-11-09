---
name: auto-apply
description: Search a job board or the open web, then apply to the matching jobs one at a time until they run out or the max-applications cap is hit.
argument-hint: "<query> (--board <domain> | --anywhere) [--min-score N] [--max-apps N] | approved | retry-failed"
---

# Auto-apply

Search, then apply to each new job at or above the minimum score, one at a time. Starting the run
is the user's approval: no per-job confirmation. Only 2FA pauses the run.

## Setup

1. Follow `../_shared/setup.md`. Feed mechanics are in `../_shared/feed-flow.md`.
2. Strip the flags; the rest is the query. Ask first if it is vague.
   - `--board <domain>` or `--anywhere`: exactly one, unless the argument is a mode below.
   - `--min-score N` as `MIN_SCORE`, else `GET /api/pilot` `config.minScore`.
   - `--max-apps N`: stop after N applied. Without it, apply to every match.
3. Get the manual feed, read `.id` as `FEED_ID`, note the current UTC time as `STARTED`, and show
   the live view `$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`:

   ```bash
   jobpilot-api POST /api/feeds --data '{"kind":"manual"}'
   ```

Modes skip the search:

- `approved`: apply to the feed's `approved` jobs.
- `retry-failed`: for each `failed` job worth retrying, `POST /api/feeds/$FEED_ID/jobs/<key>/retry`
  with its `retryNotes` (it moves back to `approved`), then apply to those.

## 1. Search

Run **Searching** in `../_shared/feed-flow.md` with `MIN_SCORE` and `NEW_JOBS` = 3 x `--max-apps`,
else 50.

## 2. Apply

List the feed's `pending` jobs (`GET /api/feeds/$FEED_ID/jobs --query status=pending --query
limit=100`, every page). Keep those created at or after `STARTED` with `matchScore >= MIN_SCORE`,
best first; with `config.preferCapExempt`, a job with `capExemptBasis` ranks 10 points higher. The
rest stay in To review. Then, one job at a time:

1. `PATCH /api/feeds/$FEED_ID/jobs/<key>` `{"status":"applying"}`. A `409`: move on (see the
   applied check in `../_shared/feed-flow.md`).
2. Delegate to `job-applier` with the input in `../_shared/feed-flow.md` and
   `preSubmitReview: false`.
3. Record its outcome per `../_shared/feed-flow.md`. On `needs_user` `verification`: tell the user
   what is needed, `PATCH` the jobs not yet tried back to `approved`, and stop; `auto-apply
   approved` resumes them.
4. Wait 3-5 seconds.

Stop once `--max-apps` jobs are applied or the list is done.

## 3. Summary

Applied, failed, skipped and waiting counts with the best few jobs, the link
`$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`, and a pointer to `auto-apply retry-failed` and the
`rescan-skipped` skill for wrongly skipped jobs.
