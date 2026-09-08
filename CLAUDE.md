# JobPilot

Multi-user AI job-application app. The web UI and API are cloud-hosted and shared. The API owns
all state. Each user runs the agent locally: Claude Code or Codex in a .NET PTY host, plus
Playwright. Dev ports: web `:4100`, API `:4101`, PTY host `:4102`.

Auth: the web fetches the user's terminal token via `POST /api/auth/tokens/terminal` and hands
it to the PTY host, which sets `JOBPILOT_API_TOKEN`. Skills send it as `Authorization: Bearer`.

## Layout

| Path | What it is |
| --- | --- |
| `apps/web/` | Next.js 16 + MUI 9 on Bun. Talks to the API over HTTP only. `src/proxy.ts` is auth middleware, not a data proxy. |
| `apps/api/` | Elysia + Prisma 7 on Bun. Owns all persistence. Exports `type App` for Eden. Swagger at `:4101/swagger`. |
| `apps/terminal/` | .NET 10 PTY host. Tests in `tests/JobPilot.Terminal.Tests/`, solution `JobPilot.slnx`. |
| `packages/contracts/` | `@jobpilot/contracts`: shared Zod schemas. |
| `packages/api-client/` | `@jobpilot/api-client`: Eden client. |
| `plugin/` | One skill tree for Claude and Codex. Edit skills here directly. |
| `docs/`, `deploy/` | User docs. Production stack. |

## Commands (`bun run <name>`)

| Command | What it does |
| --- | --- |
| `dev` | Start all three apps. `dev:api` / `dev:web` / `dev:terminal` for one. |
| `db:tunnel` | SSH tunnel to remote PostgreSQL on `localhost:5433`. |
| `db:setup` | Prisma generate + migrate + seed. |
| `test` | API tests + contracts tests. |
| `build:api` / `build:web` / `build:terminal` | Production builds. |
| `check` | Biome format + lint + import sort. Writes. |
| `ci` | `biome ci --error-on-warnings`. |
| `knip` | Dead files, exports, and dependencies. |

A local PostgreSQL and the tunnel both use port 5433. Check `docker ps` or `lsof -i :5433`
before assuming which one `DATABASE_URL` hits.

Never run `biome check --write --unsafe`. It rewrites `cookie[KEY]!.set(…)` to `?.set(…)` and
drops auth cookie writes.

Invoke the `verify` skill before committing.

## Code style

- Comment only a non-obvious why (constraint, trap, rejected alternative). One line, four max.
- No IIFEs. No fallback or compat shims; write a data migration.
- No nested ternaries. Everyday names over jargon.
- Export only what another file imports. `bun run knip` fails otherwise.
- A barrel is allowed only for a directory's public API with several outside importers, using
  named re-exports. `export *` only for a `package.json` `exports` target.
- Split a test file past a few hundred lines by domain. Shared fixtures go in `fakes.ts` or
  `builders.ts`.

## Commits

A commit message is one short sentence and nothing else.

- Imperative, under 70 characters, `type(scope):` prefix.
- No body, no bullets, no trailers (`Co-Authored-By` included).

```text
fix(pilot): revive lastSyncedAt so claims stop returning 500
```
