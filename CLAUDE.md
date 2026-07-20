# JobPilot

Multi-user AI job-application app. The Next.js web UI and the Elysia + PostgreSQL API (which owns all state) are **cloud-hosted and shared across users**; each user runs the **agent locally** - Claude Code or Codex driven through a .NET PTY host, plus Playwright browser automation - so jobs run on that user's own Claude/Codex subscription (see [project differentiator]). Dev ports: web `:4100`, API `:4101`, PTY host `:4102`.

The agent authenticates to the (possibly remote, multi-user) API as the signed-in user via a per-user personal access token (PAT).
On terminal session start the web fetches the user's **single reusable terminal token** (`POST /api/auth/tokens/terminal` - get-or-create, authed by the auth cookie) and passes it to the PTY host, which injects it as `JOBPILOT_API_TOKEN`; skills send it as `Authorization: Bearer`.
The terminal token's raw value is stored encrypted at rest (per-user DEK) so the same token is returned every time - no manual setup, no per-session accumulation.

## Layout

- `plugin/` - the JobPilot plugin, loaded by Claude from the terminal bundle (`--plugin-dir plugin`) and by Codex from the user's explicit `jobpilot@sukhrob-codex-plugins` installation. The full tree also ships inside terminal archives because the host exposes it through `JOBPILOT_SKILLS_ROOT` for shared docs and worker procedures; it is not a repo-local Codex marketplace. One tree serves both providers - no generation step. On release the Claude marketplace gets the self-contained `skills/setup` bootstrap, while the Codex marketplace gets `.codex-plugin`, `.mcp.json`, `shared/`, and the complete `skills/` tree so dashboard-launched Codex inherits every installed skill and its references.
  - `plugin/.claude-plugin/plugin.json` & `plugin/.codex-plugin/plugin.json` - provider manifests (both name the plugin `jobpilot`).
  - `plugin/.mcp.json` - Playwright MCP wiring, shared by both providers.
  - `plugin/skills/<name>/SKILL.md` - one hand-authored, provider-neutral skill per directory; `plugin/shared/*.md` - shared reference docs kept outside `skills/` so Codex does not expose them as invokable skills. **Edit here directly.**
  - `plugin/agents/<name>.md` - worker subagents (`job-worker` score/apply, `networking-worker` discover/compose) that campaign skills delegate per-iteration so the heavy browser/web/snapshot work runs in an isolated context (saves the main conversation from compaction). Claude auto-discovers these; Codex equivalents are `.codex/agents/*.toml` (repo root and terminal publish root) that point back at the same `.md`. Runtimes without custom subagents run the procedures inline (see `plugin/shared/setup.md` → "Worker subagents"). The `.md` body is the single source of truth.
- `apps/web/` - Bun + Next.js 16 + MUI 9 + TanStack Query/Form + Zod v4. The UI only; talks to the API over HTTP (no direct DB access). Browser + server call the Elysia backend **directly** via `API_BASE_URL` (`NEXT_PUBLIC_API_URL`, `apps/web/src/api/base-url.ts`) - no Next proxy. Cross-origin auth works because web and API are same-site: the httpOnly cookie rides `credentials: "include"` + CORS (`CORS_ORIGINS`). SSE/`EventSource` connects straight to the API too.
- `apps/api/` - Bun + Elysia + Prisma 7 backend at `:4101`. Owns all persistence (PostgreSQL via `DATABASE_URL`, resumes/PDFs under `apps/api/storage/`). Exports its `App` type for end-to-end Eden Treaty typing; Swagger UI at `:4101/swagger` in dev.
- `apps/terminal/` - .NET 10 minimal API hosting one provider PTY (project `JobPilot.Terminal`). Exposes `/ws`, `/sessions/start`, `/sessions/inject`, `/sessions/current`, `/healthz`. `/sessions/start` takes a per-user `apiToken` (the web fetches the reusable terminal token via `POST /api/auth/tokens/terminal`) and injects it into the PTY as `JOBPILOT_API_TOKEN`; the host env var is only a local-dev fallback. Runs on each user's machine, not the server. A C# change needs `bun run build:terminal` + a host restart to take effect.
- `packages/` - workspace libs: `@jobpilot/contracts` (Zod schemas + enums shared by API and web) and `@jobpilot/api-client` (Eden Treaty client bound to the API's `App` type).

## Commands

Root (`bun run …`):

- `dev` - runs terminal (`:4102`) + api (`:4101`) + web (`:4100`) together.
- `db:tunnel` - SSH tunnel to the remote PostgreSQL (config in `apps/api/.env`). There is no local DB container; `DATABASE_URL` points at the tunnel's local port.
- `db:setup` - generate Prisma client, apply migrations, seed default boards (runs on `apps/api`).
- `build:api` / `build:web` / `build:terminal` - production builds.
- `check` / `format` / `lint` - Biome across the whole repo (`check` = format + lint + import sort, with `--write`). Biome does not format Markdown; `.editorconfig` covers whitespace there.
- `ci` - the CI gate: `biome ci --error-on-warnings .`. Biome 2 defaults most recommended rules to *warning* and plain `biome ci` only fails on errors, so warnings must fail the build or the gate is a no-op. Infos stay advisory. Never run `biome check --write --unsafe`: the `noNonNullAssertion` fix rewrites `cookie[KEY]!.set(…)` to `?.set(…)`, silently dropping auth cookie writes.

Web (`bun --cwd=apps/web run …`):

- `typecheck` - TypeScript 7 (`tsc --noEmit`), invoked by explicit path (see below).
- `typegen` - Next route/type generation.

API (`bun --cwd=apps/api run …`):

- `dev`, `start`, `build` - Elysia server (watch / run / compile to `dist/server.exe`).
- `typecheck` - `tsc --noEmit`.
- `test` - `bun test`. Colocated `*.test.ts` next to the code. Runs in CI with no database and no env, so keep it that way: import the module under test **directly**, not through a barrel that might pull in Prisma or `@/env` (which validates at module load).
- `db:generate`, `db:migrate` (create-only), `db:migrate:apply`, `db:seed`, `db:reset`, `db:studio`.

### TypeScript 7 (`apps/web` carries two compilers - do not "clean this up")

TypeScript 7 is the Go-native compiler and ships **no JS compiler API** (no `lib/typescript.js`, no `tsserver`; an API returns in 7.1). Next.js needs that API in `build/load-jsconfig.js` to read tsconfig `paths` - without it Next silently drops every `@/…` alias and `next build` dies with module-not-found. So `apps/web` declares both:

- `typescript` (6.x) - the JS API for Next, and `tsserver` for the editor. Never imported by our code.
- `@typescript/native` (alias of `typescript@7`) - the real compiler.

Both packages declare a `tsc` bin and bun links the 6.x one, so web's `typecheck` calls the v7 binary **by explicit path**. `next build` never type-checks (`typescript.ignoreBuildErrors`); `bun run typecheck` is the only gate. `apps/api` and `packages/*` just use plain `typescript@7`.

A tsyringe-injected class must stay a **value** import (`import { PrismaClient }`, never `import type`): `emitDecoratorMetadata` builds `design:paramtypes` from those bindings, so erasing them fails at runtime with `TypeInfo not known for "Object"`. Biome's `style/useImportType` is off for `apps/api` for exactly this reason.

## Comments

Comment the non-obvious **why** - a constraint, trap, or rejected alternative the next reader would
otherwise rediscover the hard way. Never the *what*; the code says that.

- One line by default, four max. Never restate the signature, narrate the next statement, or write
  to the reviewer ("previously we…", "added because…").
- Prefer a better name over a comment explaining a murky one.

## Skill conventions

- One tree, both providers. Skills are provider-neutral: reference sibling skills by name (e.g. "invoke the `tailor-resume` skill"), not provider-specific command tokens, and reference shared docs by path-relative reference (`../../shared/<doc>.md`). Claude extras like `allowed-tools` are fine in frontmatter - Codex ignores unknown keys.
- Imperative voice, addressed to the provider.
- Start by checking `GET /api/health`; abort with a clear message if the API is down.
- Talk to the API via `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/..."`. Three env vars are injected by the terminal host - `JOBPILOT_API` is the backend base URL (`:4101` in dev, the hosted URL in prod), `JOBPILOT_API_TOKEN` is the per-user PAT, and `JOBPILOT_WEB` is the web app origin (`:4100` in dev, the hosted URL in prod) for any user-facing link. Never hard-code `localhost`. No direct DB access.
- Load profile/resume/credentials via `plugin/shared/setup.md`.
- Credential lookup: board override → `Credential.scope === <domain>` → `Credential.scope === "default"`.
- Log in proactively before searching/applying.
- Dedupe applied jobs via `GET /api/applied/check` (exact URL + fuzzy title+company, 30-day window).
- During campaigns, `PATCH /api/campaigns/[id]/jobs/[jobKey]` for non-terminal status transitions (pending → approved → applying). On terminal outcome (applied / failed / skipped), `POST /api/campaigns/[id]/jobs/[jobKey]/result` - one call updates the Job, creates the Application and initial event when applied, and marks the queue entry. Campaign summaries are derived from current rows, never persisted.
- Browser automation: use `browser_snapshot` (with `ref` for large pages), not screenshots.

## Backend layout (`apps/api/src/`)

- **Elysia app** (`app.ts`) mounts every module controller under `/api` and exports `type App` - the single source of truth for Eden Treaty client typing.
- **`modules/<name>/`** - one module per domain. `<name>.controller.ts` holds thin Elysia routes (request Zod schemas + a `detail` block for Swagger summary/tags) that delegate to the service; `<name>.service.ts` holds business logic (tsyringe `@singleton`, Prisma); `index.ts` is the barrel exporting the controller.
- **`common/`** - cross-cutting: `database` (Prisma client), `di` (tsyringe container), `errors` (`HttpError`, `notFound`/`conflict`, `findOwned` ownership-or-404), `middleware` (`authGuard` - the single auth gate on protected routes), `rate-limit` (token-bucket limiter + the `RATE_LIMITS` policy table + `acquireSlot` in-flight cap; attach one `rateLimit(policy)` per route as a `beforeHandle`), `auth`, `sse`, `pdf`, `storage`, `plugins` (cors, swagger).
- **`types/response.ts`** - shared response schemas/types: the error envelope (`errorResponseSchema`/`httpErrorResponses`), success envelopes (`idResponseSchema`, `deletedResponseSchema`, `okResponseSchema`, `messageResponseSchema`), and pagination (`paginationSchema`, `paginatedResponseSchema(item)`, `createPaginatedResponse`). Imported as `@/types/response` (the web mirrors this alias in its tsconfig `paths`).
- **Request validation is Zod from `@jobpilot/contracts`** (the package both API and web import); uuid path ids via `idParam`. Handlers return plain data (Elysia JSON-serializes it) or a raw `Response` for SSE / file streams / redirects.
- **Every JSON route declares an explicit Zod `response` success schema** (the 200 shape) in its module `<name>.schema.ts`, or a shared envelope from `@/types/response`. Model the service's return exactly - Eden Treaty infers the web client's types from it, and Elysia silently strips fields not in the schema, so under-specifying breaks the web app and the agent's curl skills.
  **Dates are `z.date()`** (the service returns the raw Prisma `Date`; Elysia validates it then serializes to an ISO string on the wire - never `.toISOString()` in a response path).
  **Never type a date as `z.string()`** - not even a `YYYY-MM-DD` day key: Eden revives any date-shaped string into a `Date`, so the web silently gets a `Date` where TS promised a `string`. Day buckets are UTC-midnight `z.date()` (`common/date/buckets.ts`); the web renders them with `timeZone: "UTC"`. Only free-text date columns (`"Summer 2024"`) stay `z.string()`. Streaming / SSE / file / redirect routes omit `response`.
- **Error responses are documented once, globally**: `app.ts` applies `.guard({ as: "scoped", response: httpErrorResponses })` to the `/api` group, so every route advertises the standard error envelope (`{ code, message, details? }`; statuses 400/401/403/404/409/422/429/500) in Swagger and Eden - never repeat error responses per route.
- Adding a route: add/reuse a request schema in `packages/contracts` (or the module `*.schema.ts`), add the route with `body`/`query`/`params` as needed + a `response` success schema + a `detail` summary, and put non-trivial logic in the module service.

## Frontend conventions (`apps/web/src/`)

- **Files**: kebab-case (`auth-card.tsx`, `use-auth.ts`). No PascalCase filenames.
- **Exports**: named for components/hooks/providers. Default exports only for `page.tsx` / `layout.tsx`.
- **RSC by default**: never put `"use client"` in pages or layouts - extract interactivity into `src/components/features/`.
- **Props**: `interface <Name>Props` (not `type`). Destructure inside the body, not in parameters.
- **Conditional render**: `cond && <X />` rather than `cond ? <X /> : null`.
- **Return type**: a component that can render nothing returns `ReactNode` and early-returns `null`, never `ReactElement` + `return <></>` (an empty fragment only exists to satisfy `ReactElement`). One that always renders keeps `ReactElement`.
- **MUI**: barrel imports (`import { Button } from "@mui/material"`), never deep imports.
- **Aliases**: `@/` maps to `src/` (e.g. `@/hooks/use-auth`).
- **Zod**: import from `zod/v4`.
- **Forms**: TanStack Form + Zod validators.
- **React 19**: use the `use()` hook for async data in client components. Never use `useCallback`, `useMemo`, or `memo` - the compiler handles it. Pass `ref` as a regular prop; do **not** use `forwardRef`.
- **List keys**: never key by array index. Key by the model's `id` - resume experience/project/education/skill rows all carry one (`backfillResumeIds` assigns it server-side). For a controlled list whose model has no id, use `useKeyedList` (`@/hooks/use-keyed-list`), which keeps keys in lockstep with move/remove/add.

## Styling Guidelines (MUI)

## Key Rules

- **Theme colors only** - never hardcode hex values. Use `"primary.main"`, `"background.paper"`, `"text.secondary"`, etc.
- **Theme spacing** - use numeric units (`p: 2` = 16px), not pixel strings
- **Typography variants** - use `variant="h4"`, not manual `fontSize`/`fontWeight`
- **`sx` prop** for one-off styling. If repeated, extract a component
- **Semantic colors** for dark mode support: `"background.paper"`, `"text.primary"`, `"divider"`

## Forbidden Patterns

- No inline `style={{ }}` - use MUI `sx` prop instead
- No `styled-components` or MUI's `styled()` - use `sx` or extract a component
- No raw `<div>` / `<span>` for layout - use `Box`, `Stack`, `Typography`
