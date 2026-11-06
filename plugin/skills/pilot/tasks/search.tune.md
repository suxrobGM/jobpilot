# `search.tune`

Payload `{feedId, query, config, counts, topSkipReasons}`. No browser. Judge the yield: query
too broad or narrow, `minScore` off, skip reasons clustered? Make one change:

- **Search**: when the search is dry or off-target, change it with one applied change (the user can
  undo it). `GET /api/feeds?kind=search` for its id and name, then `POST /api/pilot/changes` with
  `"source": "pilot"`, `"runId": "<RUN_ID>"` and one `search.update` (new `query`, a `name` to
  match, `reason` saying why), `search.pause`, or `search.delete` action.
- **Name**: a search whose `name` still equals its `query` gets a short human name (2-5 words,
  "ML engineer, new grad") in the same `search.update`, or alone when nothing else needs changing.
- **Min score**: never change it yourself. When near misses cluster just below it, propose a
  `rules.set` with the new `minScore` (at most 10 lower, never under 50): the same body with
  `"propose": true` and a summary that says why ("12 jobs scored 55-59 this week").

Summary: "'ML engineer, new grad' yielding 12% - narrowed its query to '<new>'." or "Proposed
min score 65: 12 near misses this week."
