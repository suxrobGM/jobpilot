# `question.answered`

Payload `{questionId, questionKind, subjectType, subjectId, prompt, answer}`. Route by
`subjectType`:

- **`job`** (`subjectId` = `<campaignId>:<jobKey>`) → apply as `./job.apply.md` does, adding
  `answers:<answer>` to the `job-applier` input so it never asks again.
- **`email`** (an `interview.reply` approval) → `"Send"`: send the draft from `prompt` with `POST
  /api/email/outbound {to,subject,body,threadId}`, replying to the `from` and `threadId` of `GET
  /api/email/messages/<subjectId>`. Free text: treat it as availability or corrections, revise the
  draft, then send. `"Skip"`: send nothing.
- **`networking`** (`subjectId` = a draft message id) → find the draft by `id` in `GET
  /api/networking/messages --query status=draft` `.items` (it carries `campaignId`). `"Send"`: send
  and record as `./networking.send.md` does. `"Skip"`: record `/result` `{"outcome":"skipped"}`.
- **`campaign`** (a `campaign.reviewPaused` answer, `subjectId` = campaign id) → `"Resume"`: `POST
  /api/campaigns/$SID/status {"status":"in_progress","actor":"pilot"}`. `"Complete campaign"`: the
  same with `"completed"`. `"Keep paused"`: nothing. Free text: read it as one of the three.

Summary: what you did with the answer ("Sent the Acme interview reply - Tuesday 10am.").
