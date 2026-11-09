# Feed flow

Shared by the feed skills (`search`, `auto-apply`, `apply`, `networking`, `upwork-search`) and the
pilot's tasks. Load the profile per `./setup.md` first.

## Searching

`search` and `auto-apply` use the pilot's agents, so a typed search finds and scores jobs the same
way the pilot does. The caller sets `FEED_ID`, `MIN_SCORE` and `NEW_JOBS`.

- `--board <domain>`: `GET /api/job-boards` must list it, else stop with "Board `<domain>` is not
  configured. Add it on the Job boards page or pick another board." Delegate one `job-searcher`
  run: `{runId:null, feedId:$FEED_ID, query, board:<domain>, resumeId:user.primaryResumeId,
  minScore:$MIN_SCORE, newJobsTarget:$NEW_JOBS, maxPages:null}`.
- `--anywhere`: delegate one `job-researcher` run: `{runId:null, feedId:$FEED_ID,
  criteria:<query>, resumeId:user.primaryResumeId, minScore:$MIN_SCORE, approveAtOrAbove:null,
  preferCapExempt:<GET /api/pilot config.preferCapExempt>,
  requiresSponsorship:user.requiresSponsorship, boards:<every domain in GET /api/job-boards>,
  newJobsTarget:$NEW_JOBS, focus:null}`.

The agent dedupes, scores, saves each job as `pending`, and returns a JSON summary (`newJobs`,
`best`, `skipped`, `error`).

## Applied check

Before opening a posting:

```bash
jobpilot-api GET /api/applications/duplicates --query "url=<url>" --query "title=<title>" --query "company=<company>"
```

It matches the exact URL, or title and company within 30 days. `.applied` true: create the job as
`pending`, post its result `{outcome:"skipped", skipReason:"Already applied (<.match.kind>)"}`, and
move on.

The server enforces the same rule. Moving a job to `applying` answers `409 ALREADY_APPLIED` on a
duplicate (the server has already written the skip) or `409 APPLY_IN_FLIGHT` when another worker
holds it. Either way, move to the next job; never retry.

## Job writes

- Non-terminal moves (`pending`, `approved`, `applying`): `PATCH /api/feeds/$FEED_ID/jobs/<key>`.
- Terminal outcomes: `POST /api/feeds/$FEED_ID/jobs/<key>/result`. On `applied` it also creates
  the application.

```jsonc
{ "outcome": "applied", "appliedAt": "<now, ISO 8601 UTC>", "matchScore": 87, "resumeId": "<id>", "resumeVariantId": "<id>" }
{ "outcome": "failed", "failReason": "<why>", "retryNotes": "<what to try next time>" }
{ "outcome": "skipped", "skipReason": "<reason>" }
```

Always send the `resumeId` that went into the form, and `resumeVariantId` when a tailored variant
did (reused or new). It is the only record of what was submitted.

## job-applier

Input:

```json
{ "feedId": "<FEED_ID>", "jobKey": "<key>", "url": "<url>", "board": "<domain>",
  "brief": null, "resumeId": "<id>", "salaryExpectation": null, "answers": null,
  "preSubmitReview": false, "runId": null }
```

A null `brief` makes the worker read it from the saved job. It returns `applied`, `failed`,
`skipped` or `needs_user`, with its tabs closed. Write `applied`, `failed` and `skipped` as job
results (above). Route `needs_user` by `category`:

- `salary`: ask once, remember the answer for this run, re-delegate with `salaryExpectation`.
- `question`: ask `question`, re-delegate with the reply as `answers`.
- `verification` (2FA): pause and ask.
- `review`: see the `apply` skill.
- `payment`: never pay. Result `{outcome:"failed", failReason:"Payment required"}`.

## Rules

1. Every `skipped` result has a non-empty `skipReason` from `./eligibility.md`. No valid reason,
   no skip.
2. The feed is the audit trail: every state change goes through the API.
3. Never pay for anything.
4. A CAPTCHA: try the `solve-captcha` skill; unsolved, the `job-applier` parks the job for the
   user to solve it. 2FA is a pause. Logins follow `./auth.md`.
5. Wait 3-5 seconds between submissions on the same site.
6. Report scores honestly; a stretch is a stretch.
