# `networking.send`

Payload `{campaignId, messageId, contactId, contactName, contactEmail, subject, body}`. Email only.
Send it as the `networking` skill's Phase 4 does (`POST /api/email/outbound {to,subject,body}`), then
record:

```bash
jobpilot-api POST /api/campaigns/$CID/networking/messages/$MSGID/result \
  --data '{"outcome":"sent","providerId":"<send providerId>","threadId":"<send threadId>"}'
```

A failed send → `/result` `{"outcome":"failed","failReason":"<why>"}`.

Summary: "Emailed <contactName> - <subject>."
