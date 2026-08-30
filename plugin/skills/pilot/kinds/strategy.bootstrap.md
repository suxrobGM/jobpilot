# `strategy.bootstrap`

Payload `{goals, minScore}` - goals are set (mandatory before start) but no searches exist yet. Config work, **no browser**, no worker. Load the profile and primary resume per `../../_shared/setup.md`, then derive 1-3 searches and create each via `POST /api/pilot/searches`. Body `{query, resumeId, reason}`: `query` concrete enough to paste into a board search ("senior typescript remote", not "good jobs"); `reason` one user-facing sentence on why the pilot chose it. Never pin a `board`: the configured list rotates one board per cycle, and pinning freezes the search on one. Journal: "Set up 2 searches from your goals: 'senior typescript remote', 'dotnet engineer remote'."

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/pilot/searches" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg q "<query>" --arg rid "<primary resume id>" --arg reason "<why>" \
    '{query:$q, resumeId:$rid, reason:$reason}')"
```

Discovery starts on the next cycle - do not search here.
