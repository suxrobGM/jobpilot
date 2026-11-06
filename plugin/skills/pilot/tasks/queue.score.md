# `queue.score`

Payload `{feedId, resumeId, minScore, queuedCount, entries: [{key,url}]}`: links the user pasted
into an `apply` feed. Delegate one `job-scorer` run: `{mode:"score", feedId, jobs:<up to 5
entries as {jobKey:key,url}>, resumeId, minMatchScore:<minScore>, save:"patch", runId:$RUN_ID}`. It
fills each row's real title, company and board and moves it to `pending`, or skips it. Don't apply;
the server promotes scored rows on the next task list.

Summary: "Scored 4 pasted links - 3 eligible."
