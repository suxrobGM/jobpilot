# `search.setup`

Payload `{goals, minScore}`: goals are set, and either no searches exist or every search is waiting
while the apply cap has room. No browser, no worker, no searching. Load the profile and primary
resume per `../../_shared/setup.md`, then `GET /api/pilot/searches`.

- **None exist**: derive 1-3 searches from the goals.
- **Refill**: the existing searches are spent. Delete any backing off (`emptyRuns` >= 3), then add
  1-2 that reach the goals another way (adjacent title, seniority, location, or remote), never a
  near-copy of one that exists or was just deleted. Keep at most 5 searches.

Create each:

```bash
jobpilot-api POST /api/pilot/searches \
  --data '{"query":"<query>","resumeId":"<primary resume id>","reason":"<why>"}'
```

`query` is what you'd type into a board ("senior typescript remote", not "good jobs"); `reason` is
one user-facing sentence. Never pin a `board`: boards rotate one per cycle.

Summary: "Set up 2 searches from your goals: 'senior typescript remote', 'dotnet engineer remote'."
or "Added 'ml engineer boston' and retired 'ml engineer maine' (3 empty runs)."
