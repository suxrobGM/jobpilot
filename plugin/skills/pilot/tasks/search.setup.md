# `search.setup`

Payload `{goals, minScore}`: goals are set, and either no searches exist or every search is waiting
while the apply cap has room. No browser, no worker, no searching. Load the profile and primary
resume per `../../_shared/setup.md`, then `GET /api/feeds?kind=search`.

- **None exist**: derive 1-3 searches from the goals.
- **Refill**: the existing searches are spent. Delete any backing off (`emptyRuns` >= 3), then add
  1-2 that reach the goals another way (adjacent title, seniority, location, or remote), never a
  near-copy of one that exists or was just deleted. Keep at most 5 searches.

Make every edit one change, so the user can undo it as one:

```bash
jobpilot-api POST /api/pilot/changes --data @"$JOBPILOT_TEMP/change.json"
```

```json
{ "summary": "Set up 2 searches from your goals", "source": "pilot", "runId": "<RUN_ID>",
  "actions": [
    { "type": "search.create", "name": "ML engineer, new grad", "query": "machine learning engineer new grad",
      "resumeId": "<primary resume id>", "reason": "<why>" },
    { "type": "search.delete", "searchId": "<id>" }
  ] }
```

`name` is a short plain label the user reads; `query` is what you'd type into a board ("senior
typescript remote", not "good jobs"); `reason` is one user-facing sentence. Never pin a board:
boards rotate one per cycle.

Summary: "Set up 2 searches from your goals: 'ML engineer, new grad', 'Research engineer'." or
"Added 'ML engineer, Boston' and retired 'ML engineer, Maine' (3 empty runs)."
