# `search.discover`

Payload `{searchId, query, board?, resumeId?, minScore, newJobsTarget, maxPages}`. A search is
its own feed: its jobs go to `searchId`.

1. **Search.** Delegate one `job-searcher` run with `{runId:$RUN_ID, feedId:searchId, query, board,
   resumeId, minScore, newJobsTarget, maxPages}`. Without subagent support, or if the delegation
   fails, follow `$JOBPILOT_SKILLS_ROOT/../agents/job-searcher.md` inline.

2. **Report** its counts (a `404` means the search was deleted meanwhile: say so in the summary):

   ```bash
   jobpilot-api POST /api/feeds/$SEARCH_ID/runs \
     --data '{"jobsScanned":<jobsScanned>,"newJobs":<newJobs>,"reachedEnd":<reachedEnd>}'
   ```

An `error` with no new jobs is `outcome:"failed"`; otherwise `done`, naming any `error` in the
summary.

Summary: "Discovered 8 jobs on linkedin.com for 'senior typescript remote' over 3 pages; best Acme
88, Globex 81."
