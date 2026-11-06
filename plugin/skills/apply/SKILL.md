---
name: apply
description: Apply to a single job (URL or pasted page) after a fit review and a pre-submit review.
argument-hint: "<job_url_or_pasted_job_page>"
---

# Apply - One Job

Fit review → user "yes" → fill → pre-submit review → submit. To apply to several links, add them in
the Pipeline (`$JOBPILOT_WEB/pipeline`, **Add job links**); the pilot scores and applies to them.

## Setup

Follow `../_shared/setup.md` to load profile, resume, credentials. Shared mechanics (applied-check,
result writes, worker input, rules) live in `../_shared/feed-flow.md`. `minMatchScore` =
`GET /api/pilot` → `config.minScore` (default 60).

For ATS portals (Greenhouse, Lever, Workday, etc.) the apply step lands on a domain that isn't in
`/api/job-boards`; the `job-applier` handles login/registration there per `../_shared/auth.md`.

No argument → **"Give me a job URL or paste the job page. To apply to several links, add them in
the Pipeline."** and stop.

## Phase 1: Single-Job Mode

If the argument is pasted content (HTML / text), extract description, Apply URL, company, title. If
no Apply URL can be found, stop: **"I need either a job URL or content with a visible Apply link."**

### 1.1 Fit Review

**URL input** → delegate to the `job-scorer` subagent with `mode:"review"` so the posting snapshot
stays out of this conversation: `{ "mode":"review", "url":"<job-url>",
"resumeId":"<primary-or-empty>" }`. Use its returned
`matchScore`/`strongMatches`/`partialMatches`/`gaps`/`blockers`/`visaRisk`/`recommendation` to fill
the review below; keep its `brief` as `BRIEF` for 1.4.

**Pasted input** → parse the fields yourself (the content is already in hand), build the brief
(`../_shared/job-brief.md`), and `POST /api/fit-scores {brief, minScore:<minMatchScore>}` for the
score. Its `fit.verdict` drives the recommendation below: `trust` → report the score as-is;
`deliberate` → reason from `strongMatches`/`partialMatches`/`gaps` first. Keep the brief in
`BRIEF=...` for 1.4.

```
## Job Fit Review: [Title] at [Company]

**Match Score: X/100**

**Strong Matches:** [skill - evidence]
**Partial Matches:** [skill - what's adjacent]
**Gaps:** [skill - what's missing]
**Visa/Sponsorship Risk:** [if mentioned]
**Verdict:** [1-2 sentence recommendation]
```

Ask: **"Want me to proceed with the application?"** - `yes`/`go` continue, anything else stop.

### 1.2 Dedupe Check

Run the applied-check (`../_shared/feed-flow.md`) with url + title + company. If
`.applied === true`, surface the match (title + company + appliedAt + `.match.kind`) and ask
whether to proceed anyway. Stop on no.

### 1.3 The Manual Feed

Jobs the user applies to by hand go to their manual feed; read `.id` as `FEED_ID`:

```bash
jobpilot-api POST /api/feeds --data '{"kind":"manual"}'
```

### 1.4 Add the Job

Pick a `JOB_KEY` of `<unix-seconds>-single`. Write the body to `"$JOBPILOT_TEMP/job.json"` (`brief`
is the stringified brief, `description` the posting text):

```json
{ "key": "<JOB_KEY>", "title": "<title>", "company": "<company>", "location": "<location>",
  "url": "<job-url>", "board": "<board>", "matchScore": <0-100>, "matchReason": "<one-line verdict>",
  "status": "approved", "brief": "<stringified brief>", "description": "<posting text>" }
```

```bash
jobpilot-api POST "/api/feeds/$FEED_ID/jobs" --data @"$JOBPILOT_TEMP/job.json"
```

A response with `duplicate: true` means the user already has this posting from the last 30 days:
set `$FEED_ID` and `$JOB_KEY` from its `feedId` and `key`, and if its `status` is
`applied`, tell the user and stop. Live view: `$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`.

## Phase 2: Apply

### 2.1 Mark Applying

```bash
jobpilot-api PATCH "/api/feeds/$FEED_ID/jobs/<key>" --data '{"status":"applying"}'
```

### 2.2 Apply (delegate to `job-applier`)

Delegate to the `job-applier` subagent and wait for its compact result - it navigates,
authenticates, tailors, fills, and submits in its own tab/context (keeping the form snapshots out of
this conversation). One worker at a time. Use the `job-applier` input from
`../_shared/feed-flow.md` with `brief` omitted (the worker fetches it from the saved Job) and
`preSubmitReview: true`.

**Pre-submit review:** the worker fills everything, leaves the form open, and returns `needs_user category:"review"` with a field summary in `context`.
Present:

```
## Ready to Submit: [Title] at [Company]
| Name | Email | Phone | Resume | Salary | Start date | Cover letter | Custom Qs |
<total> fields across <P> page(s). Submit? (yes / no / edit <field>)
```

`yes` → re-delegate 2.2 with `preSubmitReview:false` (the worker submits the already-filled form).
`no` → POST `/result` `outcome:"skipped"`, `skipReason:"User cancelled at pre-submit review"`. `edit
<field>` → tell the worker what to change on re-delegation.

### 2.3 Record Result

Map the worker's `outcome` to a terminal `/result` write and route `needs_user` per
`../_shared/feed-flow.md` (the worker never writes results itself; on `salary`,
re-delegate 2.2 with `salaryExpectation` set).

### 2.4 Summary

Report the outcome and link to `$JOBPILOT_WEB/pipeline?feed=<FEED_ID>`.

## Rules

The shared feed rules (`../_shared/feed-flow.md`) apply throughout. On top of them:

1. **Up-front confirmation mandatory** (1.1), then the pre-submit review (2.2).
