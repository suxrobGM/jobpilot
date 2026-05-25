# Self-Hosting

JobPilot is local-first: SQLite on disk, Next.js bound to `127.0.0.1`, no
auth, and no external services beyond the job boards your skills visit.

The reusable JobPilot workflows live in [plugin/](../plugin/) as a single
provider-neutral plugin: `plugin/skills/<name>/SKILL.md` directories plus
shared docs under `plugin/skills/shared/`, edited directly with no build step.
The same `plugin/` also carries a manifest per provider
(`plugin/.claude-plugin/plugin.json`, `plugin/.codex-plugin/plugin.json`) and
the Playwright MCP config (`plugin/.mcp.json`).

You can drive either provider through JobPilot.Terminal, or run them
directly:

```bash
claude --plugin-dir plugin
codex --no-alt-screen -C .
```

For Codex, the repo ships
[.agents/plugins/marketplace.json](../.agents/plugins/marketplace.json)
which points Codex at `./plugin`. Codex auto-discovers it when launched with
`-C <repo-root>`. On first launch open `/plugin` in Codex and enable
**JobPilot**.

## Prerequisites

- **Bun 1.3+** - runs the Next.js dev server, Prisma CLI, and seed scripts.
- **.NET 10 SDK** - required for JobPilot.Terminal.
- **Claude Code** on `PATH` (`claude --version`) - spawned by
  JobPilot.Terminal when the Claude provider is selected.
- **Codex CLI** on `PATH` (`codex --version`) - spawned by JobPilot.Terminal
  when the Codex provider is selected.

## One-Time Setup

```bash
git clone https://github.com/suxrobgm/jobpilot.git
cd jobpilot
bun install
bun --cwd src/web install
bun --cwd src/web run db:migrate:apply   # creates src/web/prisma/app.db
bun --cwd src/web run db:seed            # seeds default job boards
```

## Running

```bash
bun run dev
```

That starts:

- web app: `http://localhost:8000`
- terminal host: `http://localhost:8001`

Or run them separately:

```bash
bun --cwd src/web run dev
dotnet run --project src/terminal
```

JobPilot.Terminal owns one active provider PTY. It starts Claude Code with
`--plugin-dir plugin`, or Codex with
`codex --no-alt-screen -C <repo>`. The embedded terminal drawer lets you
switch providers. Skills check `/api/health` and stop with a clear error if
the web app is down.

First visit to `http://localhost:8000/` redirects to `/onboarding`, a
5-step wizard that creates the singleton Profile and AutopilotSettings rows.

## Direct Provider Use

From the repo root, after the web app is running:

```bash
claude --plugin-dir plugin
codex --no-alt-screen -C .
```

Claude commands:

```text
/jobpilot:search senior fullstack remote
/jobpilot:auto-apply senior fullstack remote
/jobpilot:apply https://example.com/job
```

Codex commands (bare `$<skill>`, no `jobpilot:` prefix):

```text
$search senior fullstack remote
$auto-apply senior fullstack remote
$apply https://example.com/job
```

## Production Launch

```bash
bun run build:terminal
bun run build:web
dist/terminal/JobPilot.Terminal.exe
bun --cwd src/web run start
```

The Terminal project copies the `plugin/` folder into build and publish output
(manifests, `.mcp.json`, and the `skills/` tree), rebased under `plugin/` next
to the executable.

If you package the app manually, keep the `plugin/` folder next to
`JobPilot.Terminal.exe`. For Codex, also register the local marketplace once
on the target machine so `/plugin` can install JobPilot:

```bash
codex plugin marketplace add <path-to-repo-or-published-root>
```

That command expects the directory to contain `.agents/plugins/marketplace.json`
(present in the repo root). In a published deployment without the `.agents/`
folder, run Codex against the repo directly via `codex -C <repo-root>`, or
copy the `.agents/` directory next to the executable and adjust the relative
`path` in `marketplace.json` to point at the published plugin location.

## Profile, Boards, Credentials, Resumes

All managed in the web UI:

- **Profile** at `/profile` - 5 form tabs (Personal, Address, Work auth,
  EEO, Autopilot) plus 2 view tabs (Credentials, Resumes).
- **Job boards** at `/boards` - search vs ATS, enabled toggle, per-board
  email/password override.
- **Credentials** under Profile -> Credentials - keyed by `scope`
  (`default` or a board domain). Lookup order is per-board override,
  scope-matched, then default.
- **Resumes** under Profile -> Resumes - multipart PDF upload to
  `src/web/storage/resumes/`. The chosen default path is what skills hand to
  `browser_file_upload`.

## Apply Queue

URLs go in via `/queue` (paste a list, or `POST /api/queue` with
`{"urls": [...]}`). The apply skill calls `/api/queue/pending` to pull
the next chunk and PATCHes each entry to `consumed` when applied.

## Backups

Two paths hold all local state:

- `src/web/prisma/app.db` - the entire database.
- `src/web/storage/resumes/` - uploaded PDFs.

## Resetting

- **Drop the database**: `bunx prisma migrate reset --schema ./prisma/schema --skip-seed`,
  then re-run `bun db:seed`.
- **Drop just resumes**: clear `src/web/storage/resumes/` and delete `Resume`
  rows in the UI.
- **Drop the singleton profile to re-onboard**: delete the row in Prisma
  Studio (`bun db:studio`).

## Permissions

Root [.claude/settings.json](../.claude/settings.json) grants Claude sessions
permission to use `curl`, `jq`, `date`, the Playwright MCP namespace, and the
JobPilot skills. Codex auto-discovers the JobPilot plugin via
[.agents/plugins/marketplace.json](../.agents/plugins/marketplace.json) when
launched from the repo root (`codex -C <repo>`). The user enables it once
through `/plugin`. Both provider manifests share the one `plugin/.mcp.json`.

## Troubleshooting

**`curl: (7) Failed to connect to 127.0.0.1 port 8000`** - the web app is not
running. Start it with `bun --cwd src/web run dev`.

**`ERR_DLOPEN_FAILED` from Prisma** - better-sqlite3 does not load under Bun
on Windows. JobPilot uses `@prisma/adapter-libsql`; re-run `bun install` if
`node_modules` is stale.

**Claude does not see the JobPilot skills** - start Claude with
`claude --plugin-dir plugin`, or make sure the `plugin/` folder is next to the
published Terminal executable.

**Codex does not see the JobPilot skills** - run Codex from the repo root with
`codex --no-alt-screen -C .` (so it can find `.agents/plugins/marketplace.json`)
and enable the JobPilot plugin from Codex's `/plugin` menu. If `/plugin` does
not list it, run `codex plugin marketplace add <repo-root>` once.

**Profile redirect loop** - `/profile` keeps bouncing to `/onboarding` when
the singleton Profile row is missing. Open `bun db:studio`, confirm the
`Profile` table has a row with `id = 1`, otherwise complete onboarding.

**Live viewer not updating** - the SSE broker is in-process. If multiple Bun
servers are running on different ports, only the one processing
`POST /api/runs/[id]/jobs` will publish events. Run a single dev server.
