---
name: dashboard
description: View application tracking stats across all autopilot runs. Shows totals, per-board breakdown, success rate, failure/skip reasons, and recent activity. Can export to CSV.
argument-hint: "<'stats' | 'export' | 'failed' | 'skipped' | 'board <name>'>"
---

# Application Tracking Dashboard

You present a summary of the user's job application history across all autopilot runs.

## Setup

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to load the profile and resume.

## Get Stats

Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/run-stats.sh` to get a JSON summary of all runs. Parse the output and present it based on the user's request.

### Cross-reference with Applied-Jobs Database

The `run-stats.sh` script only reads `runs/*.json` files. Some applications may have been made via `/apply` (single-job skill) and only exist in the persistent database. To get a complete picture:

1. Read `${CLAUDE_PLUGIN_ROOT}/applied-jobs.json` (if it exists) using the `Read` tool.
2. Check for entries with `source: "apply"` — these are applications not tracked in any run file.
3. Add their count to the `totalApplied` metric and include them in the applied list under a separate "Direct Applications" section.

This ensures the dashboard reflects ALL applications, not just autopilot runs.

## Commands

### Default / `stats`

If no argument is provided, or the argument is `"stats"`, present the full dashboard:

```
## Job Application Dashboard

| Metric | Count |
|--------|-------|
| Total runs | <totalRuns> |
| Jobs found | <totalJobsFound> |
| Applied (total) | <totalApplied + directApplied> |
| Applied (autopilot) | <totalApplied> |
| Applied (direct) | <directApplied> |
| Failed | <totalFailed> |
| Skipped | <totalSkipped> |
| Success rate | <successRate> |

### By Board

| Board | Found | Applied | Failed | Skipped |
|-------|-------|---------|--------|---------|
| Hiring Cafe | 45 | 15 | 5 | 25 |
| LinkedIn | 27 | 8 | 3 | 16 |

### Why Jobs Failed

| Reason | Count |
|--------|-------|
| CAPTCHA required | 3 |
| Login failed for workday.com | 2 |
| Form validation error | 1 |

### Why Jobs Were Skipped

| Reason | Count |
|--------|-------|
| Security clearance required | 10 |
| Below minimum match score | 5 |
| Already applied in previous run | 3 |
| Removed by user | 2 |

### Recent Runs

| Run | Query | Status | Applied | Failed | Skipped | Date |
|-----|-------|--------|---------|--------|---------|------|
| <runId> | <query> | <status> | <applied> | <failed> | <skipped> | <startedAt> |

**Commands:**
- "failed" -- show all failed applications with reasons and retry notes
- "skipped" -- show all skipped jobs with reasons
- "board <name>" -- show details for a specific board
- "export" -- export all applications to CSV
- "retry-failed <run-id>" -- chain to /autopilot to retry failures
```

### `failed`

Show all failed applications grouped by reason, with retry notes:

```
## Failed Applications (<totalFailed> total)

### CAPTCHA required (3)

| # | Title | Company | Board | Run |
|---|-------|---------|-------|-----|
| 1 | Software Engineer | Acme Corp | LinkedIn | 2026-03-22... |
| 2 | Full Stack Dev | BigCo | Indeed | 2026-03-22... |

### Login failed (2)

| # | Title | Company | Board | Run |
|---|-------|---------|-------|-----|
| 1 | Backend Dev | StartupCo | Workday | 2026-03-22... |
  > Retry notes: Reset password at uhg.taleo.net. Same failure as previous run.

### Form validation error (1)

| # | Title | Company | Board | Run |
|---|-------|---------|-------|-----|
| 1 | Data Engineer | DataCo | Greenhouse | 2026-03-22... |
  > Retry notes: Form required Portfolio URL field not in profile. Add it before retrying.

---
**Tip:** Use `/autopilot "retry-failed <run-id>"` to retry failures from a specific run.
```

For each failed job that has `retryNotes`, show the notes as a blockquote below the job entry.

### `skipped`

Show all skipped jobs grouped by reason:

```
## Skipped Jobs (<totalSkipped> total)

### Security clearance required (10)

| # | Title | Company | Board |
|---|-------|---------|-------|
| 1 | Systems Engineer | Raytheon | Hiring Cafe |
| 2 | Software Dev | Lockheed Martin | Hiring Cafe |
| ... |

### Below minimum match score (5)

| # | Title | Company | Board | Score |
|---|-------|---------|-------|-------|
| 1 | Junior Dev | SmallCo | Indeed | 4/10 |

### Already applied in previous run (3)

| # | Title | Company | Board | Previous Run |
|---|-------|---------|-------|-------------|
| 1 | Full Stack Dev | Acme Corp | LinkedIn | 2026-03-20... |
```

### `board <name>`

Filter stats for a specific board. Show all applied, failed, and skipped jobs from that board, including reasons.

### `export`

Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/export-csv.sh` to export all applied and failed jobs to `job-applications.csv`. Report the file path and count to the user.

## Important Rules

1. **Always use the script** to get stats. Never read run files directly.
2. **Format numbers clearly** -- use counts, not raw JSON.
3. **Keep it scannable** -- tables over paragraphs. Group by reason for failed/skipped.
4. **Always show reasons** -- the "why" is more useful than the count.
5. **Show retry notes** for failed jobs when available -- they contain actionable context.
6. **Offer next actions** after every view.
