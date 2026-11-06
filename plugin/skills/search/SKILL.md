---
name: search
description: Search a chosen job board or the open web, score the results against the user's resume, and save them to the user's manual feed for review.
argument-hint: "<query> (--board <domain> | --anywhere) [--max-jobs N]"
---

# Job Search

Search one board, or the open web with `--anywhere`, and save the scored results to the user's
manual feed. They wait in the Pipeline's Found tab for the user to approve; the pilot never applies
to them on its own.

## Setup

1. Follow `../_shared/setup.md`.
2. Parse and strip the flags; the rest is the query. If it is vague, ask before searching.
   - `--board <domain>` or `--anywhere`: exactly one is required.
   - `--max-jobs <N>`: new jobs to save, default 20.
3. The manual feed; read `.id` as `FEED_ID`:

   ```bash
   jobpilot-api POST /api/feeds --data '{"kind":"manual"}'
   ```

## Search

Run **Searching** in `../_shared/feed-flow.md` with `MIN_SCORE` 0 and `NEW_JOBS` = `--max-jobs`.
Every result stays `pending` for the user.

## Hand off

Print the agent's output as a compact table and the link, nothing else:

```
## Saved <newJobs> jobs · "<query>" - review and apply at $JOBPILOT_WEB/pipeline?feed=<FEED_ID>

| Score | Title | Company |
|-------|-------|---------|
```

List `best`, then the `skipped` reasons, the `capExempt` count and any `boardsSuggested`. Name any
`error`.
