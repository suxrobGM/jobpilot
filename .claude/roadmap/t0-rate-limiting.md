# Rate limiting

Tier 0 — Fixes · Status: **done**

## What

No rate limiting existed anywhere in the API. Throttled the abuse-prone routes first: `/auth/login`,
`/auth/register`, `/auth/password/forgot`, `/captcha/solve`.

**Correction to the original premise:** `/captcha/solve` does **not** spend the server's paid solver
credits. `CaptchaService.solve()` decrypts and uses the **user's own** 2captcha/CapSolver key from
their `Credential` row. So per-user is the right axis, and the limit is a runaway-agent guardrail,
not a cost wall. The genuine server-side risk is connection exhaustion: each call can hold a request
open ~120s (`POLL_INTERVAL_MS 5000` × `MAX_POLLS 24`), which a rate cap alone does not bound.

## Done when

Burst requests get 429s; limits are documented in the module; the rest of the API can adopt the same
middleware later. ✅

## Notes

- 2026-07-12 — Done. New `apps/api/src/common/rate-limit/`: in-memory token bucket (O(1) per key, no
  timers, exact `Retry-After`, `burst` as a first-class knob), a `policies.ts` table carrying every
  limit with a rationale, and a 5-min cron sweep. The table is capped (`MAX_KEYS`) and fails open
  under memory pressure — an unbounded map keyed by client IP is itself a DoS.
- **The keys matter more than the algorithm.** Login is keyed by **(email, IP)** so stuffing one
  account can't lock out everyone behind a shared office NAT, plus a looser per-IP net for password
  spraying. `/captcha/solve` and `/auth/email/resend` are keyed by **user**.
- **`x-real-ip` is load-bearing, not a nicety.** The API runs *inside a container*, so
  `server.requestIP()` returns the Docker bridge gateway for every proxied request — one bucket for
  the entire user base. nginx sets `X-Real-IP $remote_addr`, which *replaces* any client value.
  `X-Forwarded-For` uses `$proxy_add_x_forwarded_for`, which **appends** to a client-supplied header,
  so its leftmost entry is attacker-controlled — never read it.
- Limiters attach **per route** (`beforeHandle`), not via the plugin factory: a scoped hook covers
  every route declared after it, and the public auth routes each need a different policy. The factory
  form is used for `captchaController`, where one policy covers the instance.
- Considered and rejected `elysia-rate-limit`: its key generator receives the raw `Request`, not the
  parsed/validated body, so the (email, IP) composite key isn't expressible; its default generator
  keys off `requestIP()` (the container problem above); it's one policy per plugin instance; and its
  `errorResponse` bypasses the `HttpError` envelope. We'd still hand-write the generator, the error
  adapter, and the concurrency cap.
- 429 plumbing: `ErrorCodes.RATE_LIMITED`, a `headers` field on `HttpError` (the concurrency cap
  throws from *inside a service*, which has no `set`), `429` in `httpErrorResponses` so Swagger and
  Eden see it, and `retry-after` in CORS `exposeHeaders`.
- Verified against a running API: 5 logins through then 429 with `retry-after: 180`; a different
  email on the same IP still passes; two distinct `x-real-ip` clients get independent buckets;
  malformed bodies 422 without spending a token; `/auth/me` untouched.
