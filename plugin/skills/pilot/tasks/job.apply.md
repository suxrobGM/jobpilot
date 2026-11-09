# `job.apply`

Payload `{feedId, jobKey, jobTitle, url, board, brief, resumeId?, matchScore, warmContacts?}`.

Delegate one `job-applier` run with `feedId`, `jobKey`, `url`, `board`, `brief`, `resumeId`,
`userAsked` (the run's `askedInChat`) and `runId:$RUN_ID`. Record its outcome:

- `applied`, `failed`, `skipped`: `POST /api/feeds/$FEED_ID/jobs/$JOB_KEY/result` as in
  `../../_shared/feed-flow.md` ("Job writes"), passing the worker's `resumeId` and
  `resumeVariantId` through.
- `needs_user` with `category:"payment"`: `failed`, `Payment required`.
- Any other `needs_user`: ask, then park the job. Copy the worker's `kind`, `question`, `options`
  (default `[]`) and `savedAnswerKey` (omit when null) into `$JOBPILOT_TEMP/question.json`:

```json
{
  "kind": "<worker kind>",
  "subjectType": "job",
  "subjectId": "<feedId>:<jobKey>",
  "prompt": "<worker question>",
  "options": [],
  "savedAnswerKey": "<worker savedAnswerKey>",
  "link": "<JOBPILOT_WEB>/pipeline?feed=<feedId>"
}
```

```bash
jobpilot-api POST /api/pilot/questions --data @"$JOBPILOT_TEMP/question.json"
jobpilot-api PATCH /api/feeds/$FEED_ID/jobs/$JOB_KEY --data '{"status":"needs_user"}'
```

A `two_factor` question expires after about 5 minutes and the server skips the parked job; do
nothing more.

Summary: "Applied to <title> at <company> - score 87." / "Parked <company> application - needs your
salary answer."
