# `research.explore`

Payload `{resumeId, minScore, preferCapExempt, requiresSponsorship, boards[], newJobsTarget,
trigger, focus?}`: search the open web, beyond the user's boards, for postings that fit what the
user wants.
`focus` is what the user asked this run to look for, in their words.
`trigger` is why it runs now (`requested`, `initial`, `dry`, `periodic`). Don't apply: the server
promotes rows scoring at or above `minScore` on the next task list, and `job.apply` works them.

1. **Feed.** This returns the "Research" feed, creating it the first time; read `.id` as `FEED_ID`:

   ```bash
   jobpilot-api POST /api/feeds --data '{"kind":"research"}'
   ```

2. **Criteria.** `GET /api/feeds?kind=search`: one line per unpaused search, `name: query`, then
   its `reason` ("ML engineer: machine learning engineer new grad. New-grad roles, sponsors
   OPT."). With no search, write one line from the resume's titles and level.

3. **Research.** Delegate one `job-researcher` run with `{runId:$RUN_ID, feedId:FEED_ID, criteria,
   resumeId, minScore, approveAtOrAbove:null, preferCapExempt, requiresSponsorship, boards,
   newJobsTarget, focus}`. Without subagent support, or if the delegation fails, follow
   `$JOBPILOT_SKILLS_ROOT/../agents/job-researcher.md` inline.

4. **Report.** An `error` with no new jobs is `outcome:"failed"`; otherwise `done`, naming any
   `error` in the summary. Result `subjectType:"feed"`, `subjectId:FEED_ID`, and `detail
   {feedId, queries, boardsSuggested}` from the agent's output.

Summary names the topic, not the feed: "Researched 'ML research assistant, US universities': 9
new jobs (5 cap-exempt, 3 duplicates skipped), best UMich 84. Boards worth adding:
higheredjobs.com."
