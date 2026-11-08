# `search.setup`

Payload `{minScore, trigger}`. No browser, no worker, no searching. Load the profile and every
resume per `../../_shared/setup.md` (`GET /api/resumes/<id>` for each `content`), then
`GET /api/feeds?kind=search` and `GET /api/pilot/messages --query limit=20`.

- **`requested`**: the user asked for searches from their resumes, autopilot on or off. Group the
  resumes by the role each targets (label, recent titles, skills); near-copies of one role are one
  group, led by the primary or newest. Give each group 1-2 searches with that group's `resumeId`,
  so its jobs score against the right resume. Keep existing searches; add only roles they don't
  cover. At most 6 in all.
- **`auto`**, no searches: derive 1-3 from the primary resume (recent titles, level, location) and
  what the user said in chat. Prefer the role they hold now over a guessed pivot.
- **`auto`**, refill: delete searches backing off (`emptyRuns` >= 3), then add 1-2 that reach the
  same intent another way (adjacent title, seniority, location, remote), read from the searches'
  `query` and `reason`. Never a near-copy of an existing or just-deleted search. At most 5 in all.

Make all edits one change, so the user can undo them as one:

```bash
jobpilot-api POST /api/pilot/changes --data @"$JOBPILOT_TEMP/change.json"
```

```json
{ "summary": "Set up 2 searches from your resume", "source": "pilot", "runId": "<RUN_ID>",
  "actions": [
    { "type": "search.create", "name": "ML engineer, new grad", "query": "machine learning engineer new grad",
      "resumeId": "<that role's resume id>", "reason": "<the intent>" },
    { "type": "search.delete", "searchId": "<id>" }
  ] }
```

- `name`: a short label the user reads, 2-5 words. Never the query, its `-exclusions`, or a board
  name.
- `query`: what you'd type into a board ("senior typescript remote", not "good jobs").
- `reason`: one sentence on what the search is after. Later runs read it as the intent.
- Never pin a board: an unpinned search rotates through the configured boards.

Summary: "Set up 2 searches from your resume: 'ML engineer, new grad', 'Research engineer'. Tell
me in chat if you want something else." / "Set up 3 searches from your 2 resumes: 'ML engineer,
new grad' and 'Research assistant, PA' (ML resume), 'Data analyst' (analyst resume)." / "Added
'ML engineer, Boston' and retired 'ML engineer, Maine' (3 empty runs)." With autopilot off
(`GET /api/pilot` `autopilot`), add that the searches start once they turn it on.
