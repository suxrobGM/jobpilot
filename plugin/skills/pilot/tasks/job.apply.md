# `job.apply`

Delegate one `job-applier` run with the payload's `feedId`, `jobKey`, `url`, `board`, `brief`
and `resumeId`, plus `runId:$RUN_ID`. Record its outcome:

- `applied` / `failed` / `skipped` → `POST /api/feeds/$CID/jobs/$KEY/result` in the shapes of
  `../../_shared/feed-flow.md` ("Terminal result writes"), passing the worker's
  `resumeId`/`resumeVariantId` through.
- `needs_user` with `category:"payment"` → `failed`, `failReason:"Payment required"`.
- Any other `needs_user` → ask, then park the job. Copy the worker's `kind`, `question`, `options`
  and `savedAnswerKey` verbatim (`options` defaults to `[]`; omit a null `savedAnswerKey`) into
  `$JOBPILOT_TEMP/question.json`:

```json
{
  "kind": "<worker kind>",
  "subjectType": "job",
  "subjectId": "<feedId>:<jobKey>",
  "prompt": "<worker question>",
  "options": ["<worker options>"],
  "savedAnswerKey": "<worker savedAnswerKey>",
  "link": "<JOBPILOT_WEB>/pipeline?feed=<feedId>"
}
```

```bash
jobpilot-api POST /api/pilot/questions --data @"$JOBPILOT_TEMP/question.json"
jobpilot-api PATCH /api/feeds/$CID/jobs/$KEY --data '{"status":"needs_user"}'
```

A `two_factor` question expires after about 5 minutes and the server skips the parked job; do
nothing more.

Summary: "Applied to <title> at <company> - score 87." / "Parked <company> application - needs your
salary answer."
