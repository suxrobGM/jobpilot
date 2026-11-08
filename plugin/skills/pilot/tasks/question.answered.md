# `question.answered`

Payload `{questionId, questionKind, subjectType, subjectId, prompt, answer}`. Route by
`subjectType`:

- **`job`** (`subjectId` is `<feedId>:<jobKey>`): apply as `./job.apply.md` does, adding
  `answers:<answer>` to the `job-applier` input.
- **`email`** (an `interview.reply` approval): `Send` sends the draft in `prompt` with `POST
  /api/email/outbound` `{to, subject, body, threadId}`, replying to the `from` and `threadId` of
  `GET /api/email/messages/<subjectId>`. Free text is availability or corrections: revise the
  draft, then send. `Skip` sends nothing.
- **`networking`** (`subjectId` is a draft id): find it in `GET /api/networking/messages --query
  status=draft` (`.items`, carries `feedId`). `Send`: send and record as `./networking.send.md`
  does. `Skip`: `/result` `{"outcome":"skipped"}`.
- **`feed`** (a `search.review` answer, `subjectId` is the search id): `Resume`: `PATCH
  /api/feeds/<subjectId>` `{"paused":false,"actor":"pilot"}`. `Stop this search`: `POST
  /api/pilot/changes` `{"summary":"Stopped the search '<query>'","source":"pilot","runId":"<RUN_ID>",
  "actions":[{"type":"search.delete","searchId":"<subjectId>"}]}`. `Keep paused`: nothing. Free
  text: read it as one of the three.

Summary: what you did with the answer ("Sent the Acme interview reply - Tuesday 10am.").
