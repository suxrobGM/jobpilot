---
name: resume
description: Resume an interrupted or paused JobPilot run by id. Re-flips the run to in_progress and replays the apply loop on any remaining approved jobs without re-asking for fit confirmation.
argument-hint: "<run-id>"
---

# Resume — Continue an Interrupted Run

Resumes a `paused` or `interrupted` Run by replaying the apply loop on jobs that
are still `approved` (or `pending` if approval was implicit). The user already
approved the fit when the run was first launched, so no re-confirmation gate.

Live view: `http://localhost:8000/runs/<run-id>`.

## Setup

Follow `plugin/skills/shared/setup.md` to load profile, resume,
credentials. Check the web app is up:

```bash
JOBPILOT_API=http://localhost:8000
curl -fsS "$JOBPILOT_API/api/health" >/dev/null || { echo "JobPilot web is down. Start it with 'bun run dev'."; exit 1; }
```

## Phase 0: Resolve Run

Argument is `<run-id>`. If missing, list candidates and ask:

```bash
curl -fsS "$JOBPILOT_API/api/runs" \
  | jq -r '.data[] | select(.status=="paused" or .status=="interrupted")
           | "\(.runId)\t\(.status)\t\(.source)\t\(.query)"'
```

Fetch the run + jobs:

```bash
RUN_ID="<run-id>"
RUN=$(curl -fsS "$JOBPILOT_API/api/runs/$RUN_ID")
```

Verify status is `paused` or `interrupted`. If `completed` or `failed`, stop:
**"Run <id> is already <status>. Nothing to resume."** If `in_progress`, stop:
**"Run <id> is still in progress. If the agent crashed, wait for the
auto-reconciler (5 min) or stop the run from the UI first."**

Refuse to resume if there are no jobs with `status === "approved"`:

```bash
APPROVED=$(echo "$RUN" | jq '[.data.jobs[] | select(.status=="approved")] | length')
[ "$APPROVED" = "0" ] && { echo "No approved jobs left to apply. Mark the run completed from the UI."; exit 0; }
```

## Phase 1: Re-open the Run

PATCH status back to `in_progress`:

```bash
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d '{"status":"in_progress"}'
```

Read `config.maxApplications` from the run for the stop condition below:

```bash
MAX_APPS=$(echo "$RUN" | jq -r '.data.config.maxApplications // empty')
```

## Phase 2: Replay Apply Loop

For each job where `status === "approved"`, score-descending, run the **exact
same per-job flow as the apply skill's Phase 4** (see
`plugin/skills/apply/SKILL.md` sections 4.1 through 4.9):

1. **4.1 Mark Applying** — PATCH job to `applying`.
2. **4.2 Navigate + Find Apply** — `browser_navigate`, then `browser_snapshot` the header to find the Apply control and click its ref; `browser_snapshot` the form to enumerate fields and refs.
3. **4.3 Tailor Resume** — read the cached `jobDigest` from the RunJob row, invoke the `tailor-resume` skill with it. On failure POST `/result` `outcome:"failed"`, `failReason:"No tailorable resume base"`.
4. **4.4 Fill Forms** — follow `plugin/skills/shared/form-filling.md`; upload the tailored variant.
5. **4.5 Pre-Submit Review** — skip unless `config.maxApplications === 1`.
6. **4.6 Submit** — submit; `browser_wait_for`, then a narrowed `browser_snapshot` for the success or error result.
7. **4.7 Record Result** — POST `/api/runs/$RUN_ID/jobs/<jobKey>/result` with `outcome:"applied"`/`"failed"`/`"skipped"`. Atomic: updates RunJob, creates Application, marks queue consumed, recomputes summary.
8. **4.9 Limit** — if `MAX_APPS` set and `summary.applied >= MAX_APPS`, POST `/result` `outcome:"skipped"`, `skipReason:"Max applications limit reached"` for each remaining `approved` job and end the loop.

The `/result` endpoint preserves the run's original `source` (`"apply"` vs `"auto-apply"`) on the created Application row automatically — no separate source-passthrough needed.

### Between jobs: honor user Stop

Re-fetch the run between jobs and exit cleanly if the user stopped it:

```bash
STATUS=$(curl -fsS "$JOBPILOT_API/api/runs/$RUN_ID" | jq -r '.data.status')
if [ "$STATUS" = "paused" ]; then
  # POST /result outcome:"skipped" skipReason:"Run paused by user" for each remaining approved job, then stop
  exit 0
fi
```

## Phase 3: Summary

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -X PATCH "$JOBPILOT_API/api/runs/$RUN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"completed", completedAt:$t}')"
```

Print a summary table and the run link `http://localhost:8000/runs/<RUN_ID>`.
Suggest re-running the `auto-apply` skill in `retry-failed <RUN_ID>` mode if any jobs failed.

## Rules

1. **No new confirmation gate.** The user already approved the fit when the run was first launched.
2. **Preserve `source`** when recording applications — a resumed `apply` run still records `source:"apply"`, not `"resume"`.
3. **Idempotent.** Resuming the same run a second time should be a no-op when no `approved` jobs remain.
4. **The Run is the audit trail.** PATCH after every state change so the SSE viewer reflects reality.
