# `search.discover`

Payload `{searchId, query, board?, resumeId?, minScore, campaignId?, newJobsTarget, maxPages}`.

1. **Campaign.** Use `campaignId` when set. Otherwise this returns the search's open campaign, or
   creates it; read `.id` as `CID`:

   ```bash
   jobpilot-api POST /api/campaigns \
     --data '{"query":"<query>","source":"auto_apply","createdBy":"pilot","pilotSearchId":"<searchId>","board":"<board>","config":{"resumeId":"<resumeId>","minScore":<minScore>}}'
   ```

2. **Search.** Delegate one `job-searcher` run with `{runId:$RUN_ID, campaignId:CID, query, board,
   resumeId, minScore, newJobsTarget, maxPages}`. Without subagent support, or if the delegation
   fails, follow `$JOBPILOT_SKILLS_ROOT/../agents/job-searcher.md` inline.

3. **Report** its counts (a `404` means the search was deleted meanwhile: say so in the summary):

   ```bash
   jobpilot-api POST /api/pilot/searches/$SEARCH_ID/run-result \
     --data '{"jobsSeen":<jobsSeen>,"newJobs":<newJobs>,"reachedEnd":<reachedEnd>}'
   ```

An `error` with no new jobs is `outcome:"failed"`; otherwise `done`, naming any `error` in the
summary.

Summary: "Discovered 8 jobs on linkedin.com for 'senior typescript remote' over 3 pages; best Acme
88, Globex 81."
