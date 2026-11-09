---
name: apply
description: Apply to a single job (URL or pasted page) after a fit review and a pre-submit review.
argument-hint: "<job_url_or_pasted_job_page>"
---

# Apply

One job: fit review, the user's yes, fill, pre-submit review, submit. For several links, the user
adds them in the Pipeline (`$JOBPILOT_WEB/pipeline`, **Add job links**) and the pilot applies.

No argument: reply "Give me a job URL or paste the job page. To apply to several links, add them
in the Pipeline." and stop.

## Setup

Follow `../_shared/setup.md`. Feed mechanics are in `../_shared/feed-flow.md`. `MIN_SCORE` is
`GET /api/pilot` `config.minScore`.

Pasted content: pull out the description, apply URL, company and title. No apply URL: stop with "I
need a job URL or a page with a visible Apply link."

## 1. Fit review

- **URL**: delegate to `job-scorer` `{ "mode":"review", "url":"<url>", "resumeId":"<primary>",
  "minMatchScore":<MIN_SCORE> }`. Keep its `brief`.
- **Pasted page**: build the brief (`../_shared/job-brief.md`) and `POST /api/fit-scores`
  `{brief, minScore:<MIN_SCORE>}`. `verdict` `trust`: report the score; `deliberate`: reason from
  `strongMatches`, `partialMatches` and `gaps`.

Show:

```text
## Fit: <title> at <company>

Score: <n>/100
Strong: <skill - evidence>
Partial: <skill - what's adjacent>
Gaps: <skill - what's missing>
Visa: <risk, if any>
Verdict: <1-2 sentences>
```

Ask "Apply?" Continue only on yes.

## 2. Applied check

Run it (`../_shared/feed-flow.md`). `.applied`: show the match (title, company, applied date,
`.match.kind`) and ask whether to apply anyway.

## 3. Save the job

Get the manual feed (`POST /api/feeds --data '{"kind":"manual"}'`, read `.id` as `FEED_ID`). Write
`$JOBPILOT_TEMP/job.json` with `JOB_KEY` = `<unix-seconds>-single`:

```json
{ "key": "<JOB_KEY>", "title": "", "company": "", "location": "", "url": "<url>", "board": "<domain>",
  "matchScore": 0, "matchReason": "<one-line verdict>", "status": "approved",
  "brief": "<brief as a JSON string>", "description": "<posting text>" }
```

```bash
jobpilot-api POST /api/feeds/$FEED_ID/jobs --data @"$JOBPILOT_TEMP/job.json"
```

A response with `duplicate: true` means the user already has this posting: take `FEED_ID` and
`JOB_KEY` from its `feedId` and `key`; if its status is `applied`, say so and stop.

## 4. Apply

1. `PATCH /api/feeds/$FEED_ID/jobs/$JOB_KEY` `{"status":"applying"}`.
2. Delegate to `job-applier` with the input in `../_shared/feed-flow.md`, `brief` null and
   `preSubmitReview: true`.
3. It fills the form, leaves it open, and returns `needs_user` `category:"review"`. Show:

   ```text
   ## Ready to submit: <title> at <company>
   | Name | Email | Phone | Resume | Salary | Start date | Cover letter | Custom questions |
   Submit? (yes / no / edit <field>)
   ```

   - yes: delegate again with `preSubmitReview: false`; it submits the filled form.
   - no: result `{outcome:"skipped", skipReason:"User cancelled at pre-submit review"}`.
   - edit: delegate again with the change in `answers`.
4. Record the outcome and route other `needs_user` results per `../_shared/feed-flow.md`.

Report the outcome and `$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`.
