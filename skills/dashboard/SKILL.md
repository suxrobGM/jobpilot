---
name: dashboard
description: Open the JobPilot web dashboard or print a quick text summary of application + run stats from the API.
argument-hint: "<'open' | 'stats' | 'export' | 'failed' | 'skipped' | 'board <name>'>"
---

# Application Tracking Dashboard

The full interactive dashboard lives in the JobPilot web app. This skill is a
thin pointer to it, plus optional text summaries for inline answers.

## Setup

Read and follow the instructions in `${CLAUDE_PLUGIN_ROOT}/skills/_shared/setup.md` to verify the API is reachable.

```bash
JOBPILOT_API=http://127.0.0.1:8000
```

## Default / `open`

Tell the user to open the web dashboard:

> Open the dashboard at http://127.0.0.1:8000/. The Applications page
> (http://127.0.0.1:8000/applications) has filters, inline stage editing, and
> CSV export. The Runs page (http://127.0.0.1:8000/runs) shows live progress
> for any in-progress autopilot run.

## `stats`

Pull a text summary by combining two API calls:

```bash
curl -fsS "$JOBPILOT_API/api/dashboard/stats"
curl -fsS "$JOBPILOT_API/api/runs/stats"
```

Format the response as a quick table covering: total applied, last 7 days,
last 30 days, positive response rate, breakdown by stage / board / source,
total runs, success rate. Include a pointer to the web dashboard for the
detailed view.

## `failed`

```bash
curl -fsS "$JOBPILOT_API/api/applied?stage=rejected"
```

Group results by `failReason` (where set) and show a table with title,
company, board, appliedAt. Suggest opening the application in the web UI for
full context: `http://127.0.0.1:8000/applications/<id>`.

## `skipped`

Skipped jobs live on `RunJob` rows, not `Application` rows. Pull from runs:

```bash
curl -fsS "$JOBPILOT_API/api/runs"
```

For each run, fetch its detail and filter `jobs` where `status === "skipped"`:

```bash
curl -fsS "$JOBPILOT_API/api/runs/<runId>"
```

Group by `skipReason`.

## `board <name>`

```bash
curl -fsS "$JOBPILOT_API/api/applied?board=<board>"
```

Show all applied + rejected entries from that board with stages and dates.

## `export`

Just point the user at the CSV download:

> `curl -O "http://127.0.0.1:8000/api/applied/export.csv"` to save the file
> locally, or use the **Export CSV** button on the Applications page.

## Important Rules

1. **Prefer the web UI** for anything richer than a flat table — it has
   filters, inline editing, and stage timelines that text can't match.
2. **Numbers come from the API.** Never read SQLite, JSON files, or run files
   directly.
3. **Group by reason** when listing failed/skipped jobs. The "why" is the
   useful part.
