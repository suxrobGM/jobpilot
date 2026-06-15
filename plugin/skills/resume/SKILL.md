---
name: resume
description: Resume an interrupted or paused JobPilot campaign by id. Re-flips the campaign to in_progress and replays the apply loop on any remaining approved jobs without re-asking for fit confirmation.
argument-hint: "<campaign-id>"
---

# Resume — Continue an Interrupted Campaign

Resumes a `paused` or `interrupted` Campaign by replaying the apply loop on jobs that
are still `approved` (or `pending` if approval was implicit). The user already
approved the fit when the campaign was first launched, so no re-confirmation gate.

Live view: `http://localhost:8000/campaigns/<campaign-id>`.

## Setup

Follow `../shared/setup.md` to load profile, resume,
credentials. Check the web app is up:

```bash
JOBPILOT_API="${JOBPILOT_API:-http://localhost:8002}"
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/health" >/dev/null || { echo "JobPilot web is down. Start it with 'bun run dev'."; exit 1; }
```

## Phase 0: Resolve Campaign

Argument is `<campaign-id>`. If missing, list candidates and ask:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns" \
  | jq -r '.[] | select(.status=="paused" or .status=="interrupted")
           | "\(.campaignId)\t\(.status)\t\(.source)\t\(.query)"'
```

Fetch the campaign + jobs:

```bash
CAMPAIGN_ID="<campaign-id>"
CAMPAIGN=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID")
```

Verify status is `paused` or `interrupted`. If `completed` or `failed`, stop:
**"Campaign <id> is already <status>. Nothing to resume."** If `in_progress`, stop:
**"Campaign <id> is still in progress. If the agent crashed, wait for the
auto-reconciler (5 min) or stop the campaign from the UI first."**

Refuse to resume if there are no resumable jobs (`approved`, `pending`, or `applying`):

```bash
RESUMABLE=$(echo "$CAMPAIGN" | jq '[.jobs[] | select(.status=="approved" or .status=="pending" or .status=="applying")] | length')
[ "$RESUMABLE" = "0" ] && { echo "No resumable jobs (approved/pending/applying). If none were ever added, start fresh with the auto-apply skill."; exit 0; }
```

## Phase 1: Re-open the Campaign

PATCH status back to `in_progress`:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID" \
  -H 'content-type: application/json' \
  -d '{"status":"in_progress"}'
```

Read `config.maxApplications` from the campaign for the stop condition below:

```bash
MAX_APPS=$(echo "$CAMPAIGN" | jq -r '.config.maxApplications // empty')
```

## Phase 2: Replay Apply Loop

For each job where `status === "approved"`, `"pending"`, or `"applying"`, score-descending, run the **exact same per-job flow as the apply skill's Phase 4** (see `plugin/skills/apply/SKILL.md` sections 4.1 through 4.8):

1. **4.1 Mark Applying** — PATCH job to `applying`.
2. **4.2 Navigate + Find Apply** — `browser_navigate`, then `browser_snapshot` the header to find the Apply control and click its ref; `browser_snapshot` the form to enumerate fields and refs.
3. **4.3 Tailor Resume** — read the cached `digest` from the Job row, invoke the `tailor-resume` skill with it. On failure POST `/result` `outcome:"failed"`, `failReason:"No tailorable resume base"`.
4. **4.4 Fill Forms** — follow `../shared/form-filling.md`; upload the tailored variant.
5. **4.5 Pre-Submit Review** — skip unless `config.maxApplications === 1`.
6. **4.6 Submit** — submit; `browser_wait_for`, then a narrowed `browser_snapshot` for the success or error result.
7. **4.7 Record Result** — POST `/api/campaigns/$CAMPAIGN_ID/jobs/<key>/result` with `outcome:"applied"`/`"failed"`/`"skipped"` (a `"skipped"` outcome MUST include a non-empty `skipReason`). Atomic: updates the Job, creates Application, marks queue consumed, recomputes summary.
8. **4.8 Limit** — if `MAX_APPS` set and `summary.applied >= MAX_APPS`, POST `/result` `outcome:"skipped"`, `skipReason:"Max applications limit reached"` for each remaining `approved` job and end the loop.

The `/result` endpoint preserves the campaign's original `source` (`"apply"` vs `"auto-apply"`) on the created Application row automatically — no separate source-passthrough needed.

### Between jobs: honor user Stop

Re-fetch the campaign between jobs and exit cleanly if the user stopped it:

```bash
STATUS=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID" | jq -r '.status')
if [ "$STATUS" = "paused" ]; then
  # POST /result outcome:"skipped" skipReason:"Campaign paused by user" for each remaining approved job, then stop
  exit 0
fi
```

## Phase 3: Summary

```bash
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X PATCH "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID" \
  -H 'content-type: application/json' \
  -d "$(jq -n --arg t "$NOW" '{status:"completed", completedAt:$t}')"
```

Print a summary table and the campaign link `http://localhost:8000/campaigns/<CAMPAIGN_ID>`.
Suggest re-running the `auto-apply` skill in `retry-failed <CAMPAIGN_ID>` mode if any jobs failed.

## Rules

1. **No new confirmation gate.** The user already approved the fit when the campaign was first launched.
2. **Preserve `source`** when recording applications — a resumed `apply` campaign still records `source:"apply"`, not `"resume"`.
3. **Idempotent.** Resuming the same campaign a second time should be a no-op when no `approved` jobs remain.
4. **Never skip silently.** Every `skipped` write carries a non-empty `skipReason`.
4. **The Campaign is the audit trail.** PATCH after every state change so the SSE viewer reflects reality.
