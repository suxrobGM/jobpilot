# Budget governor

Tier 4 - Breakthrough bets · Status: **todo** · Depends on: [t1-step-telemetry.md](t1-step-telemetry.md)

## What

Per-campaign token/time budget with live burn-down from telemetry; auto-degrade to cheaper
models or pause when burn rate exceeds plan.

## Why

Makes overnight autonomy ([t2-scheduled-runs.md](t2-scheduled-runs.md)) financially predictable
on the user's own subscription.

## Done when

A campaign configured with a budget pauses (with a push notification) instead of overrunning it.

## Notes

- 2026-08-30: still blocked on the same gap, now named precisely. `GET /api/pilot/stats/cost` gives
  burn-down in wall clock, which is enough to rank kinds but not to hold a token budget. A real
  governor needs the token half of [t1-step-telemetry.md](t1-step-telemetry.md), which has no
  server-side source today.
