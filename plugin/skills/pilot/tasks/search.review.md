# `search.review`

Payload `{feedId, query, board, pausedAt}`: a paused search. No browser, no worker. Read `GET
/api/feeds/$FEED_ID` and classify the pause from `pausedReason` (else `GET
/api/feeds/$FEED_ID/job-reasons`): missing resume, verification wall, or unknown.

- Missing resume, and the search's `config.resumeId` (else `user.primaryResumeId`) is in
  `GET /api/user` `resumes` again: resume the search.

  ```bash
  jobpilot-api PATCH /api/feeds/$FEED_ID --data '{"paused":false,"actor":"pilot"}'
  ```

- Anything else: ask. Write `$JOBPILOT_TEMP/question.json` and `POST /api/pilot/questions --data
  @...`. The subject routes the answer and suppresses another review while it is open:

```json
{
  "kind": "choice",
  "subjectType": "feed",
  "subjectId": "<feedId>",
  "prompt": "The search '<query>' is paused (<reason>). Resume it?",
  "options": ["Resume", "Keep paused", "Stop this search"],
  "link": "<JOBPILOT_WEB>/pipeline?feed=<feedId>"
}
```

Summary: "Resumed the search '<query>' - resume restored." / "The search '<query>' is paused
(<reason>) - asked whether to resume."
