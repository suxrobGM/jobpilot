# `networking.send`

Payload `{campaignId, messageId, contactId, contactName, contactEmail, subject, body}`. Email channel only - the server never emits LinkedIn sends. Send via the email module exactly as the `networking` skill's Phase 4 email send (`POST /api/email/send {to,subject,body}`), then record:

```bash
curl -sS --fail-with-body -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CID/networking/$MSGID/result" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg p "$PID" --arg th "$TID" '{outcome:"sent", providerId:$p, threadId:$th}')"
```

Send failure → `/result` `{outcome:"failed", failReason:"<why>"}`. Journal with recipient + subject.
