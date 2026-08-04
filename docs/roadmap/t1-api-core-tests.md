# API core tests

Tier 1 - Foundations · Status: **done**

## What

~~Zero TypeScript tests exist~~ - **`bun test` is now bootstrapped** (2026-07-12, via
[t0-inbox-sse-leak.md](t0-inbox-sse-leak.md)): `apps/api` has a `test` script, a *Test API* step in
CI, and one colocated suite (`src/common/sse/server.test.ts`). No harness work is left; this item is
purely about coverage now.

Cover the load-bearing API core first:

- `recordJobResult` transaction (`modules/campaign/jobs/job.service.ts`) - job status, Application
  upsert, summary recompute, all atomic
- `campaign.summary.ts` folding (pure functions - easy wins)
- Crypto envelope (`common/crypto` - DEK wrap/unwrap, AAD context binding, crypto-shredding)
- Auth guards + ownership (`common/middleware`, `findOwned`)
- Scoring `modules/scoring/fit.ts`

## Done when

`bun test` runs in CI and covers those five areas. ✅

## Notes

- **2026-07-15 - shipped.** Eight new colocated suites cover all five areas (107 tests total, DB-free):
  `campaign.summary.test.ts` (folding), `common/crypto/secret.test.ts` (envelope round-trip, AAD
  binding, DEK wrap/unwrap, crypto-shredding), `scoring/fit.test.ts` + `keyword-normalize.test.ts`,
  `errors/owned.test.ts` (ownership-or-404) with `errors/http.error.test.ts` + `rate-limit/limiter.test.ts`
  as adjacent wins, and `campaign/jobs/job.service.test.ts` for `recordJobResult`. The transaction is
  exercised via a **hand-rolled fake Prisma** injected into the service - CI has no DB container, so a
  real `$transaction` can't run; the fake drives the outcome routing, Application dedupe, and summary
  recompute. Only `job.service.test.ts` needs the dummy env block (it loads
  `@/env` transitively, like `admin.guard.test.ts`); the rest import their module by relative path and
  run with no env at all.
- 2026-07-12 - Harness bootstrapped by the T0 SSE fix. The existing suite runs with **no database and
  no env**, and CI has no service container. The first test that imports a service or controller will
  need `DATABASE_URL` etc. on the *Test API* step, because `env.ts` validates at module load - expect
  that, and prefer importing modules directly over barrels that drag Prisma in.
