# `networking.send`

Payload `{feedId, messageId, contactId, contactName, contactEmail, subject, body}`. Email only.
Send it as the `networking` skill's **Send** section does: `POST /api/email/outbound`
`{to, subject, body}`, then record:

```bash
jobpilot-api POST /api/feeds/$FEED_ID/networking/messages/$MESSAGE_ID/result \
  --data '{"outcome":"sent","providerId":"<providerId>","threadId":"<threadId>"}'
```

A failed send: `/result` `{"outcome":"failed","failReason":"<why>"}`.

Summary: "Emailed <contactName> - <subject>."
