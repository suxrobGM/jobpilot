# `question.answered`

The claim payload is enriched: `{questionId, questionKind, subjectType, subjectId, prompt, answer}`. Route by `subjectType`:

- **`job`** → delegate `job-worker` apply mode per `./job.apply.md` with `answer` included in its input as `answers` (pre-provided user answers the worker reads instead of asking again); record the result exactly as that file does.
- **`email`** → the answer to an `interview.reply` approval. `"Send"` → send the drafted reply (recovered from the question `prompt`) via the email module (`POST /api/email/send {to,subject,body}`, adding `threadId` when the payload carries one, else send to `from`); free-text answer → treat it as availability/corrections, adjust the draft, then send; `"Skip"` → journal the skip. Journal the sent reply.
- **`networking`** → `subjectId` = a draft networking messageId (filed by `networking.followup`/`networking.warmIntro`). Recover the draft and its campaign from paginated campaign `.items` and `GET /api/campaigns/<id>/networking?page=1&limit=100` `.items`. `"Send"` → send and record exactly as `./networking.send.md`; `"Skip"` → record result `skipped`.
- **`campaign`** → a `campaign.reviewPaused` answer; `subjectId` = the campaignId. `"Resume"` → `POST /api/campaigns/$SID/status {"status":"in_progress","actor":"pilot"}`; `"Complete campaign"` → same route with `completed`; `"Keep paused"` → journal only; free text → interpret as one of the three. Journal the outcome.
