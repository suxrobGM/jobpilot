# `interview.prep`

Payload `{applicationId, company, jobTitle, jobUrl, resumeId}`. Generate a prep sheet by following the `interview` skill's procedure (JD from `jobUrl` if reachable, else the application's stored data; resume per `../../_shared/setup.md`). Save it:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/applied/$APP_ID/events" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg n "[interview-prep]
$SHEET" '{kind:"note", notes:$n}')"
```

The `[interview-prep]` marker prefix is load-bearing - the server dedupes on it. Journal: "Prep sheet ready for <company> <jobTitle> interview."
