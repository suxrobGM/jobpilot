---
name: resume-campaign
description: Resume a paused JobPilot campaign by id. Re-flips the campaign to in_progress and replays the apply loop on any remaining approved jobs without re-asking for fit confirmation.
argument-hint: "<campaign-id>"
---

# Resume Campaign - Continue a Paused Campaign

Resumes a `paused` Campaign by replaying the apply loop on jobs that
are still `approved` (or `pending` if approval was implicit). The user already
approved the fit when the campaign was first launched, so no re-confirmation gate.

Live view: `$JOBPILOT_WEB/pipeline?campaign=<campaign-id>`.

## Setup

Follow `../_shared/setup.md` to load profile, resume, credentials - its health check
aborts with the standard message if the backend is unreachable.

## Phase 0: Resolve Campaign

Argument is `<campaign-id>`. If missing, list candidates and ask:

```bash
jobpilot-api GET /api/campaigns --query status=paused
```

Show each of `.items` as `id`, `status`, `source`, `query`.

Fetch the campaign + jobs:

```bash
CAMPAIGN_ID="<campaign-id>"
jobpilot-api GET "/api/campaigns/$CAMPAIGN_ID"
jobpilot-api GET "/api/campaigns/$CAMPAIGN_ID/jobs" --query page=1 --query limit=100
```

Verify status is `paused`. If `completed` or `failed`, stop:
**"Campaign <id> is already <status>. Nothing to resume."** If `in_progress`, stop:
**"Campaign <id> is still in progress. Stop the campaign from the UI first."**

Refuse to resume if no job in `.items` is `approved`, `pending`, or `applying`: say **"No
resumable jobs (approved/pending/applying). If none were ever added, start fresh with the
auto-apply skill."** and stop.

## Phase 1: Re-open the Campaign

Command status back to `in_progress`:

```bash
jobpilot-api POST "/api/campaigns/$CAMPAIGN_ID/status" --data '{"status":"in_progress","actor":"agent"}'
```

Keep the campaign's `config.maxApplications` as `MAX_APPS` (absent means no limit) for the stop
condition below.

## Phase 2: Replay Apply Loop

For each job where `status === "approved"`, `"pending"`, or `"applying"`, score-descending -
the **same per-job flow as the apply skill's Apply Loop**, delegated to the `job-applier` subagent
one at a time:

1. **Mark applying** - PATCH the job to `applying`.
2. **Apply** - delegate to `job-applier` with its input from
   `../_shared/campaign-flow.md`, `brief` omitted (the worker fetches it from the saved Job)
   and `preSubmitReview: <true when MAX_APPS === 1, else false>`.

3. **Record result** - map the worker's `outcome` to a terminal `/result` write and route
   `needs_user` per `../_shared/campaign-flow.md` (on `salary`, ask once then re-delegate).
4. **Limit** - if `MAX_APPS` set and `summary.applied >= MAX_APPS`, POST `/result`
   `outcome:"skipped"`, `skipReason:"Max applications limit reached"` for each remaining `approved`
   job and end the loop.

### Between jobs: honor user Stop

Re-fetch the campaign between jobs and exit cleanly if the user stopped it:

```bash
jobpilot-api GET "/api/campaigns/$CAMPAIGN_ID"
```

If `.status` is `paused`, POST `/result` `outcome:"skipped"`, `skipReason:"Campaign paused by
user"` for each remaining `approved` job, then stop.

## Phase 3: Summary

```bash
jobpilot-api POST "/api/campaigns/$CAMPAIGN_ID/status" --data '{"status":"completed"}'
```

Print a summary table and the campaign link `$JOBPILOT_WEB/pipeline?campaign=<CAMPAIGN_ID>`.
Suggest re-running the `auto-apply` skill in `retry-failed <CAMPAIGN_ID>` mode if any jobs failed.

## Rules

The shared campaign rules (`../_shared/campaign-flow.md`) apply throughout. On top of them:

1. **No new confirmation gate.** The user already approved the fit when the campaign was first
   launched.
2. **`source` is automatic.** `/result` records the campaign's original `source` (`apply` or
   `auto_apply`) on the Application; don't pass one.
3. **Idempotent.** Resuming the same campaign a second time should be a no-op when no `approved`
   jobs remain.
