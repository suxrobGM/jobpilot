---
paths:
  - "apps/api/**"
  - "packages/**"
---

# API conventions (`apps/api`, `packages/*`)

Commands (`bun --cwd=apps/api run <name>`): `dev`, `build`, `typecheck`, `test`, `db:generate`,
`db:migrate` (create only), `db:migrate:apply`, `db:seed`, `db:reset`, `db:studio`. Prisma
schema is split by domain under `prisma/schema/*.prisma`.

## Structure (`src/`)

| Path | What it is |
| --- | --- |
| `app.ts` | Mounts every controller under `/api`. Exports `type App`, the source of Eden typing. |
| `modules/<name>/` | `<name>.controller.ts` (thin Elysia routes, Zod request schemas, Swagger `detail`) delegates to `<name>.service.ts` (tsyringe `@singleton`, Prisma). No barrels. |
| `common/errors` | `HttpError`, `notFound()`, `conflict()`, `findOwned()` (ownership or 404). |
| `common/middleware` | `authGuard`, the single auth gate. |
| `common/rate-limit` | One `rateLimit(policy)` per route as `beforeHandle`. Policies in `RATE_LIMITS`. |
| `types/response.ts` | Error envelope plus `idResponseSchema`, `deletedResponseSchema`, `okResponseSchema`. Import as `@/types/response`. |

Pagination schemas live in `@jobpilot/contracts/pagination`, shared with web and skills.

## Routes

Add a route with the `add-api-route` skill. The rules:

- Validate requests with Zod from `@jobpilot/contracts`. Use `idParam` for uuid path ids.
- Every JSON route declares a Zod `response` schema that matches the service return exactly.
  Elysia strips fields not in the schema, and Eden types the web from it. SSE, file, and
  redirect routes return a raw `Response` with no `response` schema.
- Dates are `z.date()`, never `z.string()`. Return the Prisma `Date` and let Elysia serialize.
  Eden revives date-shaped strings into `Date`, so a string date lies to the web. Day buckets are
  UTC-midnight dates from `common/date/buckets.ts`. Only free text like `"Summer 2024"` stays a
  string.
- Error responses are declared once in `app.ts` with
  `.guard({ as: "scoped", response: httpErrorResponses })`. Never per route.

## Pagination

Paginate lists that grow with use (applications, inbox, contacts, cover letters, proposals,
campaigns, campaign jobs). Small bounded lists (resumes, credentials, boards, tokens) stay
`z.array()`.

1. Query: `paginationQuerySchema.extend({ …filters })`. `csvArray(item)` for `?x=a,b`.
2. Response: `paginatedSchema(item)`.
3. Service: `...pageSlice(query)` + `count(where)`, then `paginate(rows, query, total)`.

Never hand-write `skip` / `take`. Filter and sort in SQL. Counts beside a filter come from a
`groupBy`, not the page. Cursor paging (`cursorPageSchema`, `cursorPage`) is only for
append-only feeds. The pilot journal is the sole user.

## Enums

A closed set is a Prisma `enum`, never a `String` column.

1. Add a snake_case `@@map`.
2. Values must be valid TypeScript identifiers (no hyphens, no leading digit, no `@map`).
3. Mirror it as an `as const` array in `@jobpilot/contracts`.
4. Add a row to `src/common/enum-parity.test.ts`.

## Traps

- tsyringe-injected classes must be value imports, never `import type`. Erasing them breaks
  decorator metadata at runtime. Biome's `useImportType` is off here for this reason.
- Tests (`bun test`, colocated `*.test.ts`) run with no database and no env. Import the module
  under test directly, never through a barrel that pulls in Prisma or `@/env`.
