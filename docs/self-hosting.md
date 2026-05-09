# Self-Hosting

JobPilot is local-first: SQLite on disk, Next.js bound to `127.0.0.1`, no
auth, and no external services beyond the job boards your skills visit.

The reusable JobPilot workflows live in
[src/jobpilot-skills/](../src/jobpilot-skills/). Claude and Codex provider
plugins wrap those workflows. The web UI can drive either provider through
JobPilot.Terminal, and you can also run them directly:

```bash
claude --plugin-dir src/jobpilot-claude-plugin
codex --no-alt-screen -C .
```

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
bun --cwd src/web run db:migrate:apply   # creates src/web/prisma/dev.db
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
dotnet run --project src/JobPilot.Terminal
```

JobPilot.Terminal owns one active provider PTY. It starts Claude Code with
`--plugin-dir src/jobpilot-claude-plugin`, or Codex with
`codex --no-alt-screen -C <repo>`. The embedded terminal drawer lets you
switch providers. Skills check `/api/health` and stop with a clear error if
the web app is down.

First visit to `http://localhost:8000/` redirects to `/onboarding`, a
5-step wizard that creates the singleton Profile and AutopilotSettings rows.

## Direct Provider Use

From the repo root, after the web app is running:

```bash
claude --plugin-dir src/jobpilot-claude-plugin
codex --no-alt-screen -C .
```

Claude commands:

```text
/jobpilot:search senior fullstack remote
/jobpilot:autopilot senior fullstack remote
/jobpilot:apply https://example.com/job
```

Codex commands:

```text
$jobpilot-search senior fullstack remote
$jobpilot-autopilot senior fullstack remote
$jobpilot-apply https://example.com/job
```

## Production Launch

```bash
bun run build:terminal
bun run build:web
dist/terminal/JobPilot.Terminal.exe
bun --cwd src/web run start
```

The Terminal project copies these folders into build and publish output:

- `jobpilot-skills/`
- `jobpilot-claude-plugin/`
- `jobpilot-codex-plugin/`

If you package the app manually, keep all three folders next to
`JobPilot.Terminal.exe`.

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

## Batch Queue

URLs go in via `/batch` (paste a list, or `POST /api/batch` with
`{"urls": [...]}`). The apply-batch skill calls `/api/batch/pending` to pull
the next chunk and PATCHes each entry to `consumed` when applied.

## Backups

Two paths hold all local state:

- `src/web/prisma/dev.db` - the entire database.
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
JobPilot skills. Codex plugin discovery is described by
[.agents/plugins/marketplace.json](../.agents/plugins/marketplace.json). Each
provider plugin owns its own `.mcp.json`.

## File Map

| Path                                                                        | Owner                                     |
| --------------------------------------------------------------------------- | ----------------------------------------- |
| `src/jobpilot-skills/shared/*.md`                                           | Shared setup/browser instructions.        |
| `src/jobpilot-skills/skills/*.md`                                           | Provider-neutral JobPilot workflows.      |
| `src/jobpilot-claude-plugin/.claude-plugin/plugin.json`                     | Claude Code plugin manifest.              |
| `src/jobpilot-claude-plugin/.mcp.json`                                      | Claude Playwright MCP server config.      |
| `src/jobpilot-claude-plugin/skills/<name>/SKILL.md`                         | Claude provider wrappers.                 |
| `src/jobpilot-codex-plugin/.codex-plugin/plugin.json`                       | Codex plugin manifest.                    |
| `src/jobpilot-codex-plugin/.mcp.json`                                       | Codex Playwright MCP server config.       |
| `src/jobpilot-codex-plugin/skills/<name>/SKILL.md`                          | Codex provider wrappers.                  |
| `src/web/prisma/dev.db`                                                     | All persistent state.                     |
| `src/web/storage/resumes/*.pdf`                                             | Uploaded resumes.                         |
| `src/web/prisma/schema/*.prisma`                                            | Database schema (split per domain).       |
| `src/web/src/app/api/**/route.ts`                                           | API endpoints.                            |
| `src/web/src/app/**/page.tsx`                                               | Pages (RSC).                              |
| `src/web/src/components/features/<domain>/`                                 | Domain-specific React components.         |
| `src/JobPilot.Terminal/Program.cs` + `SessionManager.cs` + `TerminalHub.cs` | .NET PTY host (HTTP + WebSocket).         |
| `src/JobPilot.Terminal/Pty/`                                                | Vendored winpty wrapper (Quick.PtyNet).   |

## Troubleshooting

**`curl: (7) Failed to connect to 127.0.0.1 port 8000`** - the web app is not
running. Start it with `bun --cwd src/web run dev`.

**`ERR_DLOPEN_FAILED` from Prisma** - better-sqlite3 does not load under Bun
on Windows. JobPilot uses `@prisma/adapter-libsql`; re-run `bun install` if
`node_modules` is stale.

**Claude does not see the JobPilot skills** - start Claude with
`claude --plugin-dir src/jobpilot-claude-plugin`, or make sure
`jobpilot-skills/` and `jobpilot-claude-plugin/` are next to the published
Terminal executable.

**Codex does not see the JobPilot skills** - run Codex from the repo root with
`codex --no-alt-screen -C .` and install or enable the local JobPilot plugin
from the marketplace entry in `.agents/plugins/marketplace.json`.

**Profile redirect loop** - `/profile` keeps bouncing to `/onboarding` when
the singleton Profile row is missing. Open `bun db:studio`, confirm the
`Profile` table has a row with `id = 1`, otherwise complete onboarding.

**Live viewer not updating** - the SSE broker is in-process. If multiple Bun
servers are running on different ports, only the one processing
`POST /api/runs/[id]/jobs` will publish events. Run a single dev server.
