# `interview.reply`

Payload `{applicationId, emailMessageId, threadId, from, subject, receivedAt, company, jobTitle}`.
Read the email (`GET /api/email/messages/$EMAIL_MESSAGE_ID`) and draft a two-to-four-sentence
reply to what they asked:

- Offered times: accept one, or say which work.
- A scheduling link: say you'll book, or have booked, through it.
- Asked for availability: two or three concrete weekday slots in the next few business days.
- Anything else (a take-home, documents, a question): answer it.

Don't restate the role or your background. At most one thank-you; no "I'm excited" or "I look
forward to speaking with you". Plain ASCII, then the `humanizer` skill in embedded mode.

Don't send. Ask the user to approve: write `$JOBPILOT_TEMP/question.json` and `POST
/api/pilot/questions --data @...`:

```json
{
  "kind": "approval",
  "subjectType": "email",
  "subjectId": "<emailMessageId>",
  "prompt": "Reply to <company> interview invite? Draft: <draft>",
  "options": ["Send", "Skip"],
  "link": "<JOBPILOT_WEB>/inbox"
}
```

Summary: "Interview invite from <company> - reply drafted, awaiting your approval."
