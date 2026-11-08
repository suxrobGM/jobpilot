# `search.setup`

Payload `{minScore}`: autopilot is on and either no searches exist or every search is spent while
the apply cap has room. No browser, no worker, no searching. Load the profile and primary resume
per `../../_shared/setup.md`, then `GET /api/feeds?kind=search` and `GET /api/pilot/messages
--query limit=20`.

- **None exist**: derive 1-3 searches from the resume (recent titles, level, location) and what
  the user said in chat. Prefer the role they hold now over a guessed pivot.
- **Refill**: delete searches backing off (`emptyRuns` >= 3), then add 1-2 that reach the same
  intent another way (adjacent title, seniority, location, remote), read from the searches'
  `query` and `reason`. Never a near-copy of an existing or just-deleted search. At most 5 in all.

Make all edits one change, so the user can undo them as one:

```bash
jobpilot-api POST /api/pilot/changes --data @"$JOBPILOT_TEMP/change.json"
```

```json
{ "summary": "Set up 2 searches from your resume", "source": "pilot", "runId": "<RUN_ID>",
  "actions": [
    { "type": "search.create", "name": "ML engineer, new grad", "query": "machine learning engineer new grad",
      "resumeId": "<primary resume id>", "reason": "<the intent>" },
    { "type": "search.delete", "searchId": "<id>" }
  ] }
```

- `name`: a short label the user reads, 2-5 words. Never the query, its `-exclusions`, or a board
  name.
- `query`: what you'd type into a board ("senior typescript remote", not "good jobs").
- `reason`: one sentence on what the search is after. Later runs read it as the intent.
- Never pin a board: an unpinned search rotates through the configured boards.

Summary: "Set up 2 searches from your resume: 'ML engineer, new grad', 'Research engineer'. Tell
me in chat if you want something else." / "Added 'ML engineer, Boston' and retired 'ML engineer,
Maine' (3 empty runs)."
