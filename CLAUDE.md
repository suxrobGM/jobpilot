# JobPilot

Multi-user AI job-application app. The Next.js web UI and the Elysia + PostgreSQL API (owner of
all state) are cloud-hosted and shared across users; each user runs the agent locally - Claude
Code or Codex in a .NET PTY host, plus Playwright - so jobs run on that user's own subscription.
Dev ports: web `:4100`, API `:4101`, PTY host `:4102`.

Auth: on terminal start the web fetches the user's reusable terminal token
(`POST /api/auth/tokens/terminal`) and hands it to the PTY host, which injects it as
`JOBPILOT_API_TOKEN`; skills send it as `Authorization: Bearer` to the API.

## Layout

- `apps/web/` - Bun + Next.js 16 + MUI 9 UI; talks to the API over HTTP only (no direct DB).
  Browser and server hit Elysia directly via `NEXT_PUBLIC_API_URL` - `src/proxy.ts` is Next 16
  auth middleware (route gating), not a data proxy.
- `apps/api/` - Bun + Elysia + Prisma 7; owns all persistence. Exports `type App` for Eden
  Treaty typing; Swagger UI at `:4101/swagger` in dev.
- `apps/terminal/` - .NET 10 PTY host (`JobPilot.Terminal`); runs on each user's machine.
- `tests/JobPilot.Terminal.Tests/` - .NET test suite for the host (solution: `JobPilot.slnx`).
- `packages/` - `@jobpilot/contracts` (shared Zod schemas), `@jobpilot/api-client` (Eden client).
- `plugin/` - the JobPilot plugin: one provider-neutral skill tree for Claude and Codex.
  **Edit skills here directly** - no generation step.
- `docs/` - user-facing docs; `deploy/` - production stack.

## Commands

Root (`bun run …`):

- `dev` - terminal + api + web together; `dev:api` / `dev:web` / `dev:terminal` run one.
- `db:tunnel` - SSH tunnel to the remote PostgreSQL, bound to `localhost:5433`. The repo ships no
  database container, so `DATABASE_URL` points at whichever PostgreSQL you supplied - a local one
  you run yourself or the tunnel. Both conventionally use 5433, so check what is actually on that
  port (`docker ps`, `lsof -i :5433`) before concluding which you are talking to.
- `db:setup` - Prisma generate + apply migrations + seed.
- `test` - the API suite plus the contracts suite (`bun test` in `apps/api` and
  `packages/contracts`).
- `build:api` / `build:web` / `build:terminal` - production builds.
- `check` / `format` / `lint` - Biome repo-wide (`check` = format + lint + import sort, writes).
  Biome skips Markdown; `.editorconfig` covers whitespace there.
- `ci` - `biome ci --error-on-warnings .`. Warnings must fail the build or the gate is a no-op.
  Never run `biome check --write --unsafe`: the `noNonNullAssertion` fix rewrites
  `cookie[KEY]!.set(…)` to `?.set(…)`, silently dropping auth cookie writes.

App-level scripts (typecheck, db:\*, …) are listed in the matching rules file below.

## Code style

Comment only the non-obvious **why** - a constraint, trap, or rejected alternative. One line by
default, four max; never restate the code or narrate to the reviewer. Prefer a better name over
a comment explaining a murky one.

- No IIFEs (`void (async () => {})()`) - use a named function or a promise chain.
- No fallback/compat shims - write a data migration instead of read-compat code.
- No nested ternaries; everyday names over jargon.
- Split a test file past a few hundred lines by domain, with a shared `*.test-helpers.ts`.

## Area rules

Per-area conventions live in `.claude/rules/` and load automatically when you touch matching
files: `api.md` (apps/api, packages), `web.md` (apps/web), `plugin.md` (plugin),
`terminal.md` (apps/terminal, tests).
