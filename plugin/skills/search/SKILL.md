---
name: search
description: Search a chosen job board or the open web, score the results against the user's resume, and save them to the user's manual feed for review.
argument-hint: "<query> (--board <domain> | --anywhere) [--max-jobs N]"
---

# Search

Search one board, or the open web with `--anywhere`, and save scored results to the user's manual
feed. They wait in the Pipeline's To review tab; the pilot never applies to them on its own.

1. Follow `../_shared/setup.md`.
2. Strip the flags; the rest is the query. Ask first if it is vague.
   - `--board <domain>` or `--anywhere`: exactly one.
   - `--max-jobs <N>`: new jobs to save, default 20.
3. Get the manual feed and read `.id` as `FEED_ID`:

   ```bash
   jobpilot-api POST /api/feeds --data '{"kind":"manual"}'
   ```

4. Run **Searching** in `../_shared/feed-flow.md` with `MIN_SCORE` 0 and `NEW_JOBS` = max jobs.
5. Print only this, from the agent's output:

   ```text
   ## Saved <newJobs> jobs for "<query>" - review at $JOBPILOT_WEB/pipeline?feed=<FEED_ID>

   | Score | Title | Company |
   |-------|-------|---------|
   ```

   Rows from `best`, then the `skipped` reasons, the `capExempt` count, any `boardsSuggested`, and
   any `error`.
