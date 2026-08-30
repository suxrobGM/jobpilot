# `campaign.reviewPaused`

Payload `{campaignId, query, board, pausedAt}` - a stuck paused auto-apply campaign. No browser, no worker. `GET /api/campaigns/$CID`; classify from `statusActor`/`statusReason` (fallback: `/jobs/reasons` + recent journal): missing resume, verification wall, user pause, or unknown.

- Missing resume and the file is restorable per `../../_shared/setup.md` → resume:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CID/status" \
  -H 'content-type: application/json' -d '{"status":"in_progress","actor":"pilot"}'
```

- Anything else → ask; never silently override a user pause. `subjectType:"campaign"` + `subjectId` are load-bearing (suppress re-review while open, route the answer):

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/pilot/questions" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg sid "$CID" --arg q "Campaign '$QUERY' is paused ($REASON). Resume it?" \
    --arg dl "$JOBPILOT_WEB/campaigns/$CID" \
    '{kind:"choice", subjectType:"campaign", subjectId:$sid, prompt:$q, options:["Resume","Keep paused","Complete campaign"], deepLink:$dl}')"
```

Journal the outcome: "Resumed campaign '<query>' - resume restored." / "Campaign '<query>' paused (<reason>) - asked whether to resume."
