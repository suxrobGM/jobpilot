# `interview.prep`

Payload `{applicationId, company, jobTitle, jobUrl, resumeId}`. Write a prep sheet with the
`interview` skill's procedure (JD from `jobUrl` when reachable, else the application's stored data;
resume per `../../_shared/setup.md`). Save `{"kind":"interview_prep","notes":"<sheet>"}` to
`$JOBPILOT_TEMP/prep.json`; once one is saved, the server offers no second prep.

```bash
jobpilot-api POST /api/applications/$APP_ID/events --data @"$JOBPILOT_TEMP/prep.json"
```

Summary: "Prep sheet ready for <company> <jobTitle> interview."
