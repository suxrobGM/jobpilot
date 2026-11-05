# `campaign.reviewPaused`

Payload `{campaignId, query, board, pausedAt}`: an auto-apply campaign stuck in `paused`. No
browser, no worker. `GET /api/campaigns/$CID` and classify the pause from
`statusChangedBy`/`statusReason` (else `/jobs/reasons`): missing resume, verification wall, user pause,
or unknown.

- Missing resume, and the file is restorable per `../../_shared/setup.md` → resume it:

```bash
jobpilot-api POST /api/campaigns/$CID/status --data '{"status":"in_progress","actor":"pilot"}'
```

- Anything else → ask; never override a user pause. Write `$JOBPILOT_TEMP/question.json` and `POST
  /api/pilot/questions --data @...`. `subjectType`/`subjectId` route the answer and suppress
  re-review while it is open:

```json
{
  "kind": "choice",
  "subjectType": "campaign",
  "subjectId": "<campaignId>",
  "prompt": "Campaign '<query>' is paused (<reason>). Resume it?",
  "options": ["Resume", "Keep paused", "Complete campaign"],
  "link": "<JOBPILOT_WEB>/campaigns/<campaignId>"
}
```

Summary: "Resumed campaign '<query>' - resume restored." / "Campaign '<query>' paused (<reason>) -
asked whether to resume."
