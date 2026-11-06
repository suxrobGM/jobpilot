# `search.review`

Payload `{feedId, query, board, pausedAt}`: a search the pilot or agent paused. No browser, no
worker. `GET /api/feeds/$FEED_ID` and classify the pause from `pausedReason` (else `/job-reasons`):
missing resume, verification wall, or unknown.

- Missing resume, and the file is restorable per `../../_shared/setup.md` → resume it:

```bash
jobpilot-api PATCH /api/feeds/$FEED_ID --data '{"paused":false,"actor":"pilot"}'
```

- Anything else → ask. Write `$JOBPILOT_TEMP/question.json` and `POST
  /api/pilot/questions --data @...`. `subjectType`/`subjectId` route the answer and suppress
  re-review while it is open:

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
