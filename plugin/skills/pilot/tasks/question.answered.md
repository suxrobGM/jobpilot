# `question.answered`

Payload `{questionId, questionKind, subjectType, subjectId, prompt, answer}`. The API applies
`Skip` and `Keep paused` itself; they never reach you. Route by `subjectType`:

- **`job`** (`subjectId` is `<feedId>:<jobKey>`): apply as `./job.apply.md` does, adding
  `answers:<answer>` and `userAsked:true` to the `job-applier` input.
- **`email`** (an `interview.reply` approval): `Send` sends the draft in `prompt` with `POST
  /api/email/outbound` `{to, subject, body, threadId}`, replying to the `from` and `threadId` of
  `GET /api/email/messages/<subjectId>`. Free text is availability or corrections: revise the
  draft, then send.
- **`networking`** (`subjectId` is a draft id): find it in `GET /api/networking/messages --query
  status=draft` (`.items`, carries `feedId`). `Send`: send and record as `./networking.send.md`
  does.
- **`feed`** (a `search.review` answer, `subjectId` is the search id): `Resume`: `PATCH
  /api/feeds/<subjectId>` `{"paused":false,"actor":"pilot"}`. `Stop this search`: `POST
  /api/pilot/changes` `{"summary":"Stopped the search '<query>'","source":"pilot","runId":"<RUN_ID>",
  "actions":[{"type":"search.delete","searchId":"<subjectId>"}]}`. Free text: read it as
  one of these, or leave the search paused.

Summary: what you did with the answer ("Sent the Acme interview reply - Tuesday 10am.").
