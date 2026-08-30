# `job.apply`

Delegate ONE `job-worker` invocation in apply mode - the input JSON from `../../_shared/campaign-flow.md` (campaignId, jobKey, url, board, digest, resumeId, plus profile fields per `../../_shared/setup.md`) plus `claimId:$CLAIM_ID` (lets the worker heartbeat through a long apply), all read from the claim payload. Heartbeat once more when it returns. Handle the four outcomes per `../../_shared/campaign-flow.md` (Terminal result writes):

- `applied` / `failed` / `skipped` → `POST /api/campaigns/$CID/jobs/$KEY/result` with the shared payload shapes. Pass the worker's `resumeId`/`resumeVariantId` straight through on `applied`.
- `needs_user` → ask the user, then park the job:

Pass the worker's `kind`, `question`, and `options` through verbatim (`options` defaults `[]`).

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/pilot/questions" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg kind "<worker kind>" --arg sid "$CID:$KEY" --arg q "<worker question>" \
    --argjson opts "<worker options, else []>" --arg dl "$JOBPILOT_WEB/campaigns/$CID" \
    '{kind:$kind, subjectType:"job", subjectId:$sid, prompt:$q, options:$opts, deepLink:$dl}')"
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CID/jobs/$KEY" \
  -H 'content-type: application/json' -d '{"status":"needs_user"}'
```

For `2fa`: the server auto-expires the question in ~5 minutes and the parked job is skipped cleanly - do nothing special, keep moving.
