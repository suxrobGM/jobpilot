# `research.explore`

Payload `{resumeId, minScore, preferCapExempt, requiresSponsorship, boards[], newJobsTarget,
trigger, focus?}`: search the open web, beyond the user's boards, for postings that fit. `focus` is
what the user asked this run to look for, in their words. `trigger` is why it runs now
(`requested`, `initial`, `dry`, `periodic`). Don't apply: the server promotes rows at or above
`minScore`.

1. **Feed.** Get the "Research" feed (created on first use) and read `.id` as `FEED_ID`:

   ```bash
   jobpilot-api POST /api/feeds --data '{"kind":"research"}'
   ```

2. **Criteria.** From `GET /api/feeds?kind=search`, one line per unpaused search: `name: query`,
   then its `reason` ("ML engineer: machine learning engineer new grad. New-grad roles, sponsors
   OPT."). No searches: one line from the resume's titles and level.

3. **Research.** Delegate one `job-researcher` run: `{runId:$RUN_ID, feedId:FEED_ID, criteria,
   resumeId, minScore, approveAtOrAbove:null, preferCapExempt, requiresSponsorship, boards,
   newJobsTarget, focus}`.

4. **Report.** An `error` with no new jobs is `failed`; otherwise `done`, naming any `error` in the
   summary. Result `subjectType:"feed"`, `subjectId:FEED_ID`, `detail:{feedId, queries,
   boardsSuggested}` from the worker's output.

Summary names the topic, not the feed: "Researched 'ML research assistant, US universities': 9 new
jobs (5 cap-exempt, 3 duplicates skipped), best UMich 84. Boards worth adding: higheredjobs.com."
