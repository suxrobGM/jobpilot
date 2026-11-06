# `feed.score`

Payload `{feedId, query, board, resumeId, minScore, pendingCount, entries: [{key,url,title}]}`:
unscored `pending` rows. Delegate one `job-scorer` run: `{mode:"score", feedId, jobs:<up to 5
entries as {jobKey:key,url,title}>, resumeId, minMatchScore:<minScore>, save:"patch",
runId:$RUN_ID}`. Don't apply; the server promotes scored rows on the next task list.

Summary: "Scored 5 jobs for 'senior typescript remote' - 3 at or above threshold."
