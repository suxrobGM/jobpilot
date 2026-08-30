# Step telemetry

Tier 1 - Foundations · Status: **todo**

## What

Per job: duration, tool calls, snapshot bytes, approximate tokens, outcome, failure class.
Follow OpenTelemetry GenAI semantic conventions rather than inventing a schema.

## Why

You cannot tune token cost or reliability you don't measure. Feeds
[t3-outcome-calibration.md](t3-outcome-calibration.md) and
[t4-budget-governor.md](t4-budget-governor.md).

## Done when

A campaign run produces per-job metrics queryable enough to answer "which step burns the most
tokens on board X?"

## Notes

- 2026-08-30: partly already true, and the item never said so. `PilotClaim` brackets one cycle's
  work (`grantedAt` -> `releasedAt`) and carries `kind`, `outcome` and the subject, so per-kind
  duration, failure and abandonment rates needed a read, not a write. Shipped as
  `GET /api/pilot/stats/cost` + the "Where the time goes" panel on `/pilot/activity`.
- What is still missing is the token half: tool calls, snapshot bytes, approximate tokens. Those
  are not on the server at all - the host drives a PTY and sees rendered text, so the only source
  is the provider's own session file, which differs per provider. Scope any follow-up to that gap.
