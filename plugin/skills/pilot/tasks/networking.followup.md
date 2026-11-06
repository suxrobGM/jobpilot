# `networking.followup`

Payload `{feedId, messageId, contactId, contactName, contactEmail, subject, sentAt, daysSince,
channel, autonomy}`. Write a two- or three-sentence follow-up that refers to `subject` and adds one
thing the first message lacked: another proof point from the resume, a link to recent work, or a
narrower ask. No "just following up", "circling back", "bumping this", or guilt about their inbox.
Plain ASCII, then the `humanizer` skill in embedded mode.

Save it as a new draft on `channel` for `contactId` via `POST /api/feeds/$FEED_ID/networking/messages` (the
body the `networking` skill saves); keep the returned `id` as `DRAFT_ID`. Then gate on `autonomy`:

- `"auto"` → send and record it as `./networking.send.md` does, with `DRAFT_ID` as the message id.
- `"draft"` → stop; the user sends it from `$JOBPILOT_WEB/networking/messages`.
- `"review"` → write `$JOBPILOT_TEMP/question.json` and `POST /api/pilot/questions --data @...`.
  `subjectType`/`subjectId` route the answer to `question.answered`:

```json
{
  "kind": "approval",
  "subjectType": "networking",
  "subjectId": "<DRAFT_ID>",
  "prompt": "Send follow-up to <contactName> re <subject>?",
  "options": ["Send", "Skip"],
  "link": "<JOBPILOT_WEB>/networking/messages?message=<DRAFT_ID>"
}
```

Summary: "Follow-up to <contactName> re <subject> - sent." (or "drafted" / "awaiting your
approval").
