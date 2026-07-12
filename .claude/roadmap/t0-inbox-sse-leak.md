# Inbox SSE tenant leak (security)

Tier 0 — Fixes · Status: **done**

## What

The `inbox` SSE channel's topic was the constant string `"inbox"`, so every connected client on
`/api/email/events` received all users' `sync.progress` / `message.scanned` / `message.reviewed`
events. Campaign/workspace/upwork channels scope correctly by id/profile; this one didn't.

**Worse than reported:** the broker keeps a 64-entry replay buffer *per topic*, so one constant topic
also meant one shared history — a newly connecting user could replay other tenants' events via
`Last-Event-ID`, not just receive live ones.

## Done when

Topic is keyed by `profileId` like workspace/upwork; a cross-user test proves isolation. ✅

## Notes

- 2026-07-12 — Done. `inboxChannel` is now `defineChannel<InboxEvent, void, { profileId: string }>`
  with `topic: ({ profileId }) => String(profileId)`. The `Channel` type already separated
  `TUrlParams` from `TTopicParams`, so the client URL stays param-free and the web consumer needed no
  change. All five publishers already held `profileId` in scope — each sat one line below a
  `findOwned()` ownership check the publish was quietly escaping.
- Bootstrapped `bun test` in `apps/api` (the repo's first TS test) — `src/common/sse/server.test.ts`
  covers both halves: the live cross-user leak and the shared replay buffer. No database needed; the
  bug lives in the pure channel/broker layer. Wired into CI after *Typecheck API*.
- Verified the test fails against the old constant topic before landing the fix.
- Gotcha for anyone extending it: `subscribe()` is an async *generator function*, so calling it
  registers nothing — the body runs on the first `.next()`. Publish before that and the event is
  dropped.
