---
paths:
  - "apps/api/**"
  - "packages/**"
---

# API conventions (`apps/api`, `packages/*`)

Commands (`bun --cwd=apps/api run …`): `dev` / `start` / `build` (compiles to `dist/server.exe`),
`typecheck`, `test`, `db:generate`, `db:migrate` (create-only), `db:migrate:apply`, `db:seed`,
`db:reset`, `db:studio`. Schema is split by domain under `apps/api/prisma/schema/*.prisma`.
`apps/api` and `packages/*` use plain `typescript@7`.

## Structure (`apps/api/src/`)

- `app.ts` mounts every module controller under `/api` and exports `type App` - the single
  source of truth for Eden Treaty client typing.
- `modules/<name>/` - one module per domain: `<name>.controller.ts` (thin Elysia routes:
  request Zod schemas + a `detail` block for Swagger) delegates to `<name>.service.ts`
  (tsyringe `@singleton`, Prisma). No `index.ts` barrel - `app.ts` imports each controller file
  directly.
- `common/` - cross-cutting: `database`, `di`, `errors` (`HttpError`, `notFound`/`conflict`,
  `findOwned` ownership-or-404), `middleware` (`authGuard` - the single auth gate),
  `rate-limit` (token-bucket + `RATE_LIMITS` policy table + `acquireSlot`; attach one
  `rateLimit(policy)` per route as a `beforeHandle`), `auth`, `sse`, `pdf`, `storage`, `plugins`. Only the directories with several outside importers
  keep a barrel; the rest are imported by file path.
- `types/response.ts` - the error envelope (`errorResponseSchema`/`httpErrorResponses`) and the
  success envelopes (`idResponseSchema`, `deletedResponseSchema`, `okResponseSchema`). Import as `@/types/response` (the web mirrors this alias). Pagination
  is **not** here - it lives in `@jobpilot/contracts/pagination`, which the web and the agent's
  skills also read.

## Routes

To add one, invoke the `add-api-route` skill. The rules it encodes:

- Request validation is Zod from `@jobpilot/contracts`; uuid path ids via `idParam`. Handlers
  return plain data (Elysia JSON-serializes) or a raw `Response` for SSE / files / redirects.
- Every JSON route declares an explicit Zod `response` success schema (module `<name>.schema.ts`
  or a shared envelope). Model the service's return exactly: Eden infers the web client's types
  from it, and Elysia silently strips fields not in the schema - under-specifying breaks the web
  app and the agent's curl skills. Streaming / SSE / file / redirect routes omit `response`.
- Dates are `z.date()`: the service returns the raw Prisma `Date`; Elysia serializes to ISO on
  the wire - never `.toISOString()` in a response path. Never type a date as `z.string()`, not
  even a `YYYY-MM-DD` day key: Eden revives date-shaped strings into `Date`, so the web silently
  gets a `Date` where TS promised a `string`. Day buckets are UTC-midnight `z.date()`
  (`common/date/buckets.ts`); the web renders them with `timeZone: "UTC"`. Only free-text date
  columns (`"Summer 2024"`) stay `z.string()`.
- Error responses are declared once, globally: `app.ts` applies
  `.guard({ as: "scoped", response: httpErrorResponses })` to the `/api` group - never repeat
  error responses per route.

## Pagination

Paginate a list that **grows with usage** (applications, inbox mail, contacts, cover letters,
proposals, campaigns + jobs) through `@jobpilot/contracts/pagination`. One capped by a small
real-world limit stays a bare `z.array(...)` - resumes, credentials, job boards, open
questions, sitemaps, aggregates, `/auth/tokens`, `/push/subscriptions`.

- Query `paginationQuerySchema.extend({ …filters })` (`csvArray(item)` for a repeatable `?x=a,b` filter), response `paginatedSchema(item)`, 
  service `...pageSlice(query)` + `count(where)` -> `paginate(rows, query, total)`. Never a hand-written `skip`/`take`.
- Filter and sort in **SQL**. A browser-side filter or a post-fetch `.sort()` only ever covers
  the page it was handed.
- Page-scoped totals are a bug: counts shown beside a filter come from a `groupBy`
  (`/applied/summary`, `campaignSummary.byStatus`, `/jobs/reasons`).
- Cursor paging (`cursorPageSchema`/`cursorPage`) is for append-only live feeds only, where
  offset drifts as rows are prepended. The pilot journal is the sole user.

## Traps

- A tsyringe-injected class must stay a **value** import (`import { PrismaClient }`, never
  `import type`): `emitDecoratorMetadata` builds `design:paramtypes` from those bindings, so
  erasing them fails at runtime with `TypeInfo not known for "Object"`. Biome's
  `style/useImportType` is off for `apps/api` for exactly this reason.
- Tests (`bun test`, colocated `*.test.ts`) run in CI with no database and no env - keep it
  that way: import the module under test **directly**, never through a barrel that might pull
  in Prisma or `@/env` (which validates at module load).
