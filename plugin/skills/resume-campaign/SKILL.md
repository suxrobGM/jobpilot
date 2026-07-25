---
name: resume-campaign
description: Resume a paused JobPilot campaign by id. Re-flips the campaign to in_progress and replays the apply loop on any remaining approved jobs without re-asking for fit confirmation.
argument-hint: "<campaign-id>"
---

# Resume Campaign - Continue a Paused Campaign

Resumes a `paused` Campaign by replaying the apply loop on jobs that
are still `approved` (or `pending` if approval was implicit). The user already
approved the fit when the campaign was first launched, so no re-confirmation gate.

Live view: `$JOBPILOT_WEB/campaigns/<campaign-id>`.

## Setup

Follow `../_shared/setup.md` to load profile, resume, credentials - its health check
aborts with the standard message if the backend is unreachable.

## Phase 0: Resolve Campaign

Argument is `<campaign-id>`. If missing, list candidates and ask:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns" \
  | jq -r '.items[] | select(.status=="paused")
           | "\(.campaignId)\t\(.status)\t\(.source)\t\(.query)"'
```

Fetch the campaign + jobs:

```bash
CAMPAIGN_ID="<campaign-id>"
CAMPAIGN=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID")
JOBS=$(curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/jobs?page=1&limit=100")
```

Verify status is `paused`. If `completed` or `failed`, stop:
**"Campaign <id> is already <status>. Nothing to resume."** If `in_progress`, stop:
**"Campaign <id> is still in progress. Stop the campaign from the UI first."**

Refuse to resume if there are no resumable jobs (`approved`, `pending`, or `applying`):

```bash
RESUMABLE=$(echo "$JOBS" | jq '[.items[] | select(.status=="approved" or .status=="pending" or .status=="applying")] | length')
[ "$RESUMABLE" = "0" ] && { echo "No resumable jobs (approved/pending/applying). If none were ever added, start fresh with the auto-apply skill."; exit 0; }
```

## Phase 1: Re-open the Campaign

Command status back to `in_progress`:

```bash
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/status" \
  -H 'content-type: application/json' \
  -d '{"status":"in_progress","actor":"agent"}'
```

Read `config.maxApplications` from the campaign for the stop condition below:

```bash
MAX_APPS=$(echo "$CAMPAIGN" | jq -r '.config.maxApplications // empty')
```

## Phase 2: Replay Apply Loop

For each job where `status === "approved"`, `"pending"`, or `"applying"`, score-descending - the **same per-job flow as the apply skill's Apply Loop**, delegated to the `job-worker` subagent one at a time:

1. **Mark applying** - PATCH the job to `applying`.
2. **Apply** - delegate to `job-worker` with the apply-mode input from
   `../_shared/campaign-flow.md`, `digest` omitted (the worker fetches it from the saved Job)
   and `preSubmitReview: <true when MAX_APPS === 1, else false>`.

3. **Record result** - map the worker's `outcome` to a terminal `/result` write and route
   `needs_user` per `../_shared/campaign-flow.md` (on `salary`, ask once then re-delegate).
4. **Limit** - if `MAX_APPS` set and `summary.applied >= MAX_APPS`, POST `/result` `outcome:"skipped"`, `skipReason:"Max applications limit reached"` for each remaining `approved` job and end the loop.

The `/result` endpoint preserves the campaign's original `source` (`"apply"` vs `"auto-apply"`) on the created Application row automatically - no separate source-passthrough needed.

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
curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" -X POST "$JOBPILOT_API/api/campaigns/$CAMPAIGN_ID/status" \
  -H 'content-type: application/json' \
  -d '{"status":"completed"}'
```

Print a summary table and the campaign link `$JOBPILOT_WEB/campaigns/<CAMPAIGN_ID>`.
Suggest re-running the `auto-apply` skill in `retry-failed <CAMPAIGN_ID>` mode if any jobs failed.

## Rules

The shared campaign rules (`../_shared/campaign-flow.md`) apply throughout. On top of them:

1. **No new confirmation gate.** The user already approved the fit when the campaign was first launched.
2. **Preserve `source`** when recording applications - a resumed `apply` campaign still records `source:"apply"`, not `"resume"`.
3. **Idempotent.** Resuming the same campaign a second time should be a no-op when no `approved` jobs remain.
