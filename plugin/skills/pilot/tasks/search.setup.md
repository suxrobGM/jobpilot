# `search.setup`

Payload `{minScore}`: autopilot is on and either no searches exist or every search is waiting
while the apply cap has room. No browser, no worker, no searching. Load the profile and primary
resume per `../../_shared/setup.md`, then `GET /api/feeds?kind=search` and
`GET /api/pilot/messages --query limit=20`.

- **None exist**: the user turned on autopilot without telling you what they want. Derive 1-3
  searches from the resume (its recent titles, level and location) and anything the user said in
  chat. Prefer the role they hold now over a guess at a pivot.
- **Refill**: the existing searches are spent. Delete any backing off (`emptyRuns` >= 3), then add
  1-2 that reach the same intent another way (adjacent title, seniority, location, or remote),
  read from the searches' `query` and `reason`. Never a near-copy of one that exists or was just
  deleted. Keep at most 5 searches.

Make every edit one change, so the user can undo it as one:

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

`name` is a short plain label the user reads (2-5 words, never the query, its `-exclusions`, or a
board name, which the app shows on its own); `query` is what you'd type into a board ("senior
typescript remote", not "good jobs"); `reason` is one user-facing sentence on what the search is
after, which later runs read as the intent. Never pin a board: an unpinned search rotates the
configured boards one per cycle, a pinned one stays on its board.

Summary: "Set up 2 searches from your resume: 'ML engineer, new grad', 'Research engineer'. Tell
me in chat if you want something else." or "Added 'ML engineer, Boston' and retired 'ML engineer,
Maine' (3 empty runs)."
