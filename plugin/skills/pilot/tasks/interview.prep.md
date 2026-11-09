# `interview.prep`

Payload `{applicationId, company, jobTitle, jobUrl, resumeId}`. Write a prep sheet with the
`interview` skill's procedure (`../../interview/SKILL.md`), using the posting at `jobUrl` when
reachable, else the application's stored data. Save it as an event; once one exists, the server
offers no second prep. Write `{"kind":"interview_prep","notes":"<sheet>"}` to
`$JOBPILOT_TEMP/prep.json`, then:

```bash
jobpilot-api POST /api/applications/$APP_ID/events --data @"$JOBPILOT_TEMP/prep.json"
```

Summary: "Prep sheet ready for <company> <jobTitle> interview."
