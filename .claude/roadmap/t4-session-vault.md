# Browser session vault

Tier 4 - Breakthrough bets · Status: **todo**

## What

Encrypt Playwright storage-state (cookie jars) per board with the existing per-user DEK infra
and sync via the API. Login state survives restarts and moves across machines.

## Why

Most stuck loops are auth/2FA - this attacks the root cause and reduces how often
[t2-needs-user-escalation.md](t2-needs-user-escalation.md) even fires.

## Security

Needs the same crypto rigor as credentials: AAD context binding (`common/crypto/secret.ts`
SECRET_CONTEXTS), crypto-shred on user delete.

## Done when

After a host restart, the agent resumes a board session without re-login; vault round-trips
across two machines.

## Notes

- (add dated notes here)
