# `networking.followup`

Payload `{campaignId, messageId, contactId, contactName, contactEmail, subject, sentAt, daysSince, channel, autonomy}`. Compose a 2-3 sentence follow-up (reference the original `subject`; `humanizer` in embedded mode for tone; plain ASCII), create it as a **new** draft via `POST /api/campaigns/$CID/networking` (the shape the `networking` skill saves a draft, on the payload's `channel`, reusing `contactId`); capture the returned draft's `id` as `DRAFT_MSGID`. Then apply the **autonomy gate** on the payload's `autonomy`. It never says `"off"`: the server drops the item instead.

- `"auto"` → send immediately and record sent, exactly as `./networking.send.md` (messageId = `$DRAFT_MSGID`).
- `"draft"` → stop after saving; the user picks the draft up at `$JOBPILOT_WEB/networking/messages`.
- `"review"` → POST a question against the draft and stop - `subjectType:"networking"` + the draft's messageId is what lets a later cycle's `question.answered` route the answer:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/pilot/questions" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg sid "$DRAFT_MSGID" --arg q "Send follow-up to $NAME re $SUBJECT?" \
    --arg dl "$JOBPILOT_WEB/networking/messages?message=$DRAFT_MSGID" \
    '{kind:"approval", subjectType:"networking", subjectId:$sid, prompt:$q, options:["Send","Skip"], deepLink:$dl}')"
```
