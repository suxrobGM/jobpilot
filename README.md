# JobPilot

A Claude Code plugin for AI-driven job applications, paired with a local
Next.js + SQLite web app that owns all of the state.

- **Skills** (Claude Code) do the work: scrape job boards, score postings
  against your resume, fill in applications via Playwright, write cover
  letters and interview prep, etc.
- **Web app** (`web/`) at `http://127.0.0.1:8000` owns all data: profile,
  credentials, resumes, job boards, applications with stage funnel, runs
  with SSE-driven live progress, batch URL queue.
- **Skills talk to the web app over HTTP** (`curl`), not the filesystem.
  No more `profile.json`, `applied-jobs.json`, `runs/*.json`, or shell
  scripts.

## Quick start

```bash
# 1. Install web dependencies (one-time)
git clone https://github.com/suxrobgm/jobpilot.git
cd jobpilot/web
bun install
bun run db:migrate:apply         # creates the SQLite database and applies the schema
bun run db:seed                  # seeds default job boards

# 2. Start the web app (keep this running)
bun dev                          # serves on http://127.0.0.1:8000

# 3. Install the plugin in Claude Code
# Add this directory to your Claude Code plugins, then run any skill:
/jobpilot:apply <job-url>
/jobpilot:autopilot "senior fullstack developer remote"
/jobpilot:search "react contract us-remote"
```

For dashboards and history, open the web app at `http://127.0.0.1:8000/`.

If a skill is run while the web app is down it stops with a clear
message and tells you to start it.

## Skills

| Slash command | Purpose |
|---|---|
| `/jobpilot:apply <url>` | Auto-fill a single application after a fit review and dedupe check. |
| `/jobpilot:apply-batch` | Pull URLs from `/api/batch/pending`, score against your resume, get one-click batch approval, apply to all. |
| `/jobpilot:autopilot <query>` | Search every enabled board, score, batch-approve, apply autonomously. Live viewer at `/runs/<id>`. |
| `/jobpilot:search <query>` | Search boards and rank results without applying. |
| `/jobpilot:cover-letter <description>` | Tailored cover letter, run through the humanizer. |
| `/jobpilot:upwork-proposal <job>` | Tailored Upwork proposal. |
| `/jobpilot:interview <description>` | Behavioral / technical / company-research interview prep. |

## Web app

A local Next.js dashboard at `http://127.0.0.1:8000` that owns every
persistent fact: profile, resumes, credentials, job boards, applied jobs
with stage funnel, autopilot/batch runs, and the URL queue. It's where
you configure JobPilot, watch runs progress live over SSE, and review
your application history. Skills read and write everything through its
HTTP API.

## Documentation

See [docs/architecture.md](docs/architecture.md) for the architecture
walk-through and [docs/self-hosting.md](docs/self-hosting.md) for the
operations + configuration runbook. Convention rules live in
[CLAUDE.md](CLAUDE.md).

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Bun 1.3 |
| Framework | Next.js 16 (App Router, RSC, typed routes) |
| UI | MUI 9, themed (`web/src/theme/`); MUI X DataGrid for tables; emotion via `AppRouterCacheProvider` |
| Forms | TanStack Form 1 + Zod v4 (shared between API validators and form validators) |
| Server state | TanStack Query 5 with structured `queryKeys` |
| Database | SQLite via Prisma 7 modern client + `@prisma/adapter-libsql` (Bun-compatible on Windows) |
| Browser automation | Playwright via the Claude Code Playwright MCP |

## License

MIT. The Humanizer submodule has its own license — see `skills/humanizer/`.
