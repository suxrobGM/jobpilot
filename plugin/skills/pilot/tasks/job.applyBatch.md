# `job.applyBatch`

`payload.jobs` holds 1-3 jobs, each from a different campaign and all already `applying`. Apply to
them side by side, one browser each.

1. Give entry _i_ (0-based) the browser server `playwright`, `playwright-2`, `playwright-3` in that
   order. Never two appliers on one server: a profile opens in exactly one browser.
2. Delegate one `job-applier` run per entry **at the same time** (several delegations in one turn),
   each with that entry's `campaignId`, `jobKey`, `url`, `board`, `brief` and `resumeId`, plus
   `runId:$RUN_ID` and its `browserServer`. Every applier heartbeats the same run, which keeps it
   alive while any of them works.
3. No parallel subagents (or a delegation fails): apply to the entries one after another in
   `playwright`, inline per `../../_shared/setup.md`. Slower, still correct.
4. Record each applier's outcome as soon as it returns, exactly as `job.apply.md` does: the
   `/result` write, or the question plus the `needs_user` PATCH. One job's failure never stops the
   others.

Post one run result once every applier has returned. `outcome` is `"done"` unless the batch itself
errored; per-job failures are recorded on the jobs. `subjectType`/`subjectId`: the run's own.

Summary: one clause per job, e.g. "Applied to Staff Engineer at Acme - score 87; parked Globex
application - needs your salary answer; skipped Initech - CAPTCHA."
