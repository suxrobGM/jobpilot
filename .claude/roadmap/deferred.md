# Deferred / rejected (with reasons)

Recorded so future sessions don't re-litigate. Revisit only if the stated condition changes.

- **Step-level checkpoint/resume DB** (AgentRun→Task→Step→Attempt hierarchy, from the Codex
  review): browser state can't actually resume mid-form — sessions expire, pages reset;
  re-navigate + re-fill is the real recovery path. Job-level leases + step *telemetry* give ~90%
  of the value at ~20% of the machinery. Revisit only if a real recovery case demands it.
- **Per-user contextual bandit now:** too little data per user (tens of applications, weeks of
  outcome delay) — noise wearing a math costume. Do calibration display + pooled priors first
  ([t3-outcome-calibration.md](t3-outcome-calibration.md)).
- **Fit-critic / recovery-agent multi-agent roles:** speculative token burn; scouts
  ([t3-scout-apply-pipeline.md](t3-scout-apply-pipeline.md)) and the receipt/verifier
  ([t3-formir-answer-ledger.md](t3-formir-answer-ledger.md)) are the multi-agent roles with
  clear ROI.

## Superseded by the Pilot consolidation (2026-07-15)

Eighteen item files were deleted; their designs live on in [pilot.md](pilot.md) ("Where the
absorbed items landed") and [pilot-learning.md](pilot-learning.md). Decisions that reversed a
previous item, recorded so they aren't re-litigated:

- **Campaign-scoped lease endpoint (`POST /api/campaigns/:id/lease`, ex t2-job-leases):**
  superseded by the generic `PilotLease` (kind + subject + TTL) — the Pilot leases outreach
  sends, inbox batches, and discovery runs, not just campaign jobs. Job-level (never
  step-level) granularity stands, per the entry above.
- **Host cron for scheduled runs (ex t2-scheduled-runs):** rejected — schedule state on the
  user's machine can't be edited from a phone. Scheduling is server-side in the instructions/agenda
  (`sleepSeconds`/`nextWakeAt`); the host is a clamped sleeper holding one bit (enabled).
- **Headless-start endpoint on the host:** unnecessary — one-time pairing persists the
  reusable terminal token on the host (DPAPI/0600) and the conductor self-starts sessions.
- **Separate supervisor-watchdog component (ex t5-supervisor-watchdog):** merged into the
  PilotConductor — the sentinel loop driver and the stall watchdog are the same deterministic
  host service.
- **Outcome calibration as a standalone item (ex t3-outcome-calibration):** it is the strategy
  tier of pilot-learning's memory; still display-first, pooled priors before any bandit.
