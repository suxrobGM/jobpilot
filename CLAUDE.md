# JobPilot

Multi-user AI job-application app. The Next.js web UI and the Elysia + PostgreSQL API (which owns all state) are **cloud-hosted and shared across users**; each user runs the **agent locally** — Claude Code or Codex driven through a .NET PTY host, plus Playwright browser automation — so jobs run on that user's own Claude/Codex subscription (see [project differentiator]). Dev ports: web `:8000`, API `:8002`, PTY host `:8001`.

The agent authenticates to the (possibly remote, multi-user) API as the signed-in user via a per-user personal access token (PAT). On terminal session start the web fetches the user's **single reusable terminal token** (`POST /api/auth/tokens/terminal` — get-or-create, authed by the auth cookie) and passes it to the PTY host, which injects it as `JOBPILOT_API_TOKEN`; skills send it as `Authorization: Bearer`. The terminal token's raw value is stored encrypted at rest (per-user DEK) so the same token is returned every time — no manual setup, no per-session accumulation.

## Layout

- `plugin/` — the JobPilot plugin, loaded by Claude (`--plugin-dir plugin`) and Codex (via `.agents/plugins/marketplace.json` → `./plugin`). One tree serves both providers — no generation step.
  - `plugin/.claude-plugin/plugin.json` & `plugin/.codex-plugin/plugin.json` — provider manifests (both name the plugin `jobpilot`).
  - `plugin/.mcp.json` — Playwright MCP wiring, shared by both providers.
  - `plugin/skills/<name>/SKILL.md` — one hand-authored, provider-neutral skill per directory; `plugin/skills/shared/*.md` — shared docs. **Edit here directly.**
- `apps/web/` — Bun + Next.js 16 + MUI 9 + TanStack Query/Form + Zod v4. The UI only; talks to the API over HTTP (no direct DB access). Browser + server call the Elysia backend **directly** via `API_BASE_URL` (`NEXT_PUBLIC_API_URL`, `apps/web/src/api/base-url.ts`) — no Next proxy. Cross-origin auth works because web and API are same-site: the httpOnly cookie rides `credentials: "include"` + CORS (`CORS_ORIGINS`). SSE/`EventSource` connects straight to the API too.
- `apps/api/` — Bun + Elysia + Prisma 7 backend at `:8002`. Owns all persistence (PostgreSQL via `DATABASE_URL`, resumes/PDFs under `apps/api/storage/`). Exports its `App` type for end-to-end Eden Treaty typing; Swagger UI at `:8002/swagger` in dev.
- `apps/terminal/` — .NET 10 minimal API hosting one provider PTY (project `JobPilot.Terminal`). Exposes `/ws`, `/sessions/start`, `/sessions/inject`, `/sessions/current`, `/healthz`. `/sessions/start` takes a per-user `apiToken` (the web fetches the reusable terminal token via `POST /api/auth/tokens/terminal`) and injects it into the PTY as `JOBPILOT_API_TOKEN`; the host env var is only a local-dev fallback. Runs on each user's machine, not the server. A C# change needs `bun run build:terminal` + a host restart to take effect.
- `packages/` — workspace libs: `@jobpilot/contracts` (Zod schemas + enums shared by API and web) and `@jobpilot/api-client` (Eden Treaty client bound to the API's `App` type).

## Commands

Root (`bun run …`):

- `dev` — runs terminal (`:8001`) + api (`:8002`) + web (`:8000`) together.
- `db:up` / `db:down` — start/stop the local PostgreSQL container (`docker-compose.dev.yml`).
- `db:setup` — generate Prisma client, apply migrations, seed default boards (runs on `apps/api`).
- `build:api` / `build:web` / `build:terminal` — production builds.

Web (`bun --cwd=apps/web run …`):

- `lint`, `typecheck`, `format` — Next lint, `tsc --noEmit`, Prettier.
- `typegen` — Next route/type generation.

API (`bun --cwd=apps/api run …`):

- `dev`, `start`, `build` — Elysia server (watch / run / compile to `dist/server.exe`).
- `typecheck` — `tsc --noEmit`.
- `db:generate`, `db:migrate` (create-only), `db:migrate:apply`, `db:seed`, `db:reset`, `db:studio`.

## Skill conventions

- One tree, both providers. Skills are provider-neutral: reference sibling skills by name (e.g. "invoke the `tailor-resume` skill"), not provider-specific command tokens, and reference shared docs by path-relative reference (`../shared/<doc>.md`). Claude extras like `allowed-tools` are fine in frontmatter — Codex ignores unknown keys.
- Imperative voice, addressed to the provider.
- Start by checking `GET /api/health`; abort with a clear message if the API is down.
- Talk to the API via `curl -fsS -H "authorization: Bearer $JOBPILOT_API_TOKEN" "$JOBPILOT_API/api/..."`. Both env vars are injected by the terminal host — `JOBPILOT_API` is the backend base URL (`:8002` in dev, the hosted URL in prod), `JOBPILOT_API_TOKEN` is the per-user PAT. No direct DB access.
- Load profile/resume/credentials via `plugin/skills/shared/setup.md`.
- Credential lookup: board override → `Credential.scope === <domain>` → `Credential.scope === "default"`.
- Log in proactively before searching/applying.
- Dedupe applied jobs via `GET /api/applied/check` (exact URL + fuzzy title+company, 30-day window).
- During campaigns, `PATCH /api/campaigns/[id]/jobs/[jobKey]` for non-terminal status transitions (pending → approved → applying). On terminal outcome (applied / failed / skipped), `POST /api/campaigns/[id]/jobs/[jobKey]/result` — one call updates the Job, creates the Application row (when applied), marks the queue entry, and recomputes the campaign summary.
- Browser automation: use `browser_snapshot` (with `ref` for large pages), not screenshots.

## Backend layout (`apps/api/src/`)

- **Elysia app** (`app.ts`) mounts every module controller under `/api` and exports `type App` — the single source of truth for Eden Treaty client typing.
- **`modules/<name>/`** — one module per domain. `<name>.controller.ts` holds thin Elysia routes (request Zod schemas + a `detail` block for Swagger summary/tags) that delegate to the service; `<name>.service.ts` holds business logic (tsyringe `@singleton`, Prisma); `index.ts` is the barrel exporting the controller.
- **`common/`** — cross-cutting: `database` (Prisma client), `di` (tsyringe container), `errors` (`HttpError`, `notFound`/`conflict`, `findOwned` ownership-or-404), `middleware` (`authGuard`, `profileGuard` — profile routes are the default), `auth`, `sse`, `pdf`, `storage`, `plugins` (cors, swagger).
- **`types/response.ts`** — shared response schemas/types: the error envelope (`errorResponseSchema`/`httpErrorResponses`), success envelopes (`idResponseSchema`, `deletedResponseSchema`, `okResponseSchema`, `messageResponseSchema`), and pagination (`paginationSchema`, `paginatedResponseSchema(item)`, `createPaginatedResponse`). Imported as `@/types/response` (the web mirrors this alias in its tsconfig `paths`).
- **Request validation is Zod from `@jobpilot/contracts`** (the package both API and web import); uuid path ids via `idParam`. Handlers return plain data (Elysia JSON-serializes it) or a raw `Response` for SSE / file streams / redirects.
- **Every JSON route declares an explicit Zod `response` success schema** (the 200 shape) in its module `<name>.schema.ts`, or a shared envelope from `@/types/response`. Model the service's return exactly — Eden Treaty infers the web client's types from it, and Elysia silently strips fields not in the schema, so under-specifying breaks the web app and the agent's curl skills. **Dates are `z.date()`** (the service returns the raw Prisma `Date`; Elysia validates it then serializes to an ISO string on the wire — never `.toISOString()` in a response path). Genuine string values (e.g. `YYYY-MM-DD` bucket keys, free-text date columns) stay `z.string()`. Streaming / SSE / file / redirect routes omit `response`.
- **Error responses are documented once, globally**: `app.ts` applies `.guard({ as: "scoped", response: httpErrorResponses })` to the `/api` group, so every route advertises the standard error envelope (`{ code, message, details? }`; statuses 400/401/403/404/409/422/500) in Swagger and Eden — never repeat error responses per route.
- Adding a route: add/reuse a request schema in `packages/contracts` (or the module `*.schema.ts`), add the route with `body`/`query`/`params` as needed + a `response` success schema + a `detail` summary, and put non-trivial logic in the module service.

## Frontend conventions (`apps/web/src/`)

- **Files**: kebab-case (`auth-card.tsx`, `use-auth.ts`). No PascalCase filenames.
- **Exports**: named for components/hooks/providers. Default exports only for `page.tsx` / `layout.tsx`.
- **RSC by default**: never put `"use client"` in pages or layouts — extract interactivity into `src/components/features/`.
- **Props**: `interface <Name>Props` (not `type`). Destructure inside the body, not in parameters.
- **Conditional render**: `cond && <X />` rather than `cond ? <X /> : null`.
- **MUI**: barrel imports (`import { Button } from "@mui/material"`), never deep imports.
- **Aliases**: `@/` maps to `src/` (e.g. `@/hooks/use-auth`).
- **Zod**: import from `zod/v4`.
- **Forms**: TanStack Form + Zod validators.
- **React 19**: use the `use()` hook for async data in client components. Never use `useCallback`, `useMemo`, or `memo` — the compiler handles it. Pass `ref` as a regular prop; do **not** use `forwardRef`.

## Styling Guidelines (MUI)

## Key Rules

- **Theme colors only** — never hardcode hex values. Use `"primary.main"`, `"background.paper"`, `"text.secondary"`, etc.
- **Theme spacing** — use numeric units (`p: 2` = 16px), not pixel strings
- **Typography variants** — use `variant="h4"`, not manual `fontSize`/`fontWeight`
- **`sx` prop** for one-off styling. If repeated, extract a component
- **Semantic colors** for dark mode support: `"background.paper"`, `"text.primary"`, `"divider"`

## Forbidden Patterns

- No inline `style={{ }}` — use MUI `sx` prop instead
- No `styled-components` or MUI's `styled()` — use `sx` or extract a component
- No raw `<div>` / `<span>` for layout — use `Box`, `Stack`, `Typography`
