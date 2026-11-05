# `research.explore`

Payload `{goals, resumeId, minScore, preferCapExempt, requiresSponsorship, boards[], newJobsTarget,
trigger}`: search the open web, beyond the user's boards, for postings that fit the goals.
`trigger` is why it runs now (`requested`, `initial`, `dry`, `periodic`). Don't apply: the server
promotes rows scoring at or above `minScore` on the next task list, and `job.apply` works them.

1. **Campaign.** This returns the open "Research" campaign, or creates it; read `.id` as `CID`:

   ```bash
   jobpilot-api POST /api/campaigns \
     --data '{"query":"Research","source":"auto_apply","createdBy":"pilot","feed":"research","config":{"resumeId":"<resumeId>","minScore":<minScore>}}'
   ```

2. **Research.** Delegate one `job-researcher` run with `{runId:$RUN_ID, campaignId:CID, goals,
   resumeId, minScore, approveAtOrAbove:null, preferCapExempt, requiresSponsorship, boards,
   newJobsTarget}`. Without subagent support, or if the delegation fails, follow
   `$JOBPILOT_SKILLS_ROOT/../agents/job-researcher.md` inline.

3. **Report.** An `error` with no new jobs is `outcome:"failed"`; otherwise `done`, naming any
   `error` in the summary. Result `subjectType:"campaign"`, `subjectId:CID`, and `detail
   {campaignId, queries, boardsSuggested}` from the agent's output.

Summary names the topic, not the campaign: "Researched 'ML research assistant, US universities': 9
new jobs (5 cap-exempt, 3 duplicates skipped), best UMich 84. Boards worth adding:
higheredjobs.com."
