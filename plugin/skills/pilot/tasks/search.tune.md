# `search.tune`

Payload `{feedId, query, config, counts, topSkipReasons}`. No browser. Judge the yield: is the
query too broad or narrow, the min score off, the skip reasons clustered? Make one change:

- **Search** dry or off-target: one applied change. Find its id and name in `GET
  /api/feeds?kind=search`, then `POST /api/pilot/changes` with `"source":"pilot"`,
  `"runId":"<RUN_ID>"` and one `search.update` (new `query`, a matching `name`, a `reason` saying
  why), `search.pause` or `search.delete`.
- **Name** still equal to its query (or the query minus its `-exclusions`): give it a short human
  name (2-5 words, "ML engineer, new grad") in the same `search.update`, or alone.
- **Min score**: never change it yourself. When near misses cluster just below it, propose a
  `rules.set` with a new `minScore` (at most 10 lower, never under 50): the same body with
  `"propose": true` and a summary that says why ("12 jobs scored 55-59 this week").

Summary: "'ML engineer, new grad' yielding 12% - narrowed its query to '<new>'." / "Proposed min
score 65: 12 near misses this week."
