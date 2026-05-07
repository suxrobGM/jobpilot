# Architecture

JobPilot 2.0 is two pieces glued together over HTTP.

## The two halves

**Claude Code skills** under `skills/<name>/SKILL.md` are markdown prompts
that Claude reads as instructions. They're the "AI muscle": parse a job
posting, score it against the resume, drive Playwright to fill an
application, write a cover letter. They don't store anything themselves.

**Next.js + SQLite web app** under `web/` is the "data layer + UI". It
owns every persistent fact: who you are, what jobs you've applied to,
what stage each application is in, every autopilot run with its per-job
status. The Prisma schema lives across one file per domain under
`web/prisma/schema/`.

Skills call the web app via `curl http://127.0.0.1:8000/api/...`. They
never touch the database directly; they never read or write JSON files.
If the web app is down, skills stop with a clear message asking the user
to start it.

```
┌───────────────────────┐                ┌────────────────────────┐
│ Claude Code skill     │  curl HTTP →   │  Next.js API routes    │
│ (apply, autopilot,    │                │  app/api/*             │
│  search, cover-letter)│  ← JSON        │  zod-validate, Prisma  │
└───────────────────────┘                └────────────┬───────────┘
                                                      │
                                                      ▼
                                              ┌──────────────────┐
                                              │ SQLite (libSQL)  │
                                              │ web/prisma/dev.db│
                                              └──────────────────┘
                                                      │
┌───────────────────────┐                ┌────────────┴───────────┐
│ Browser at :8000      │  TanStack      │  React Server          │
│ MUI 9 pages, live     │  Query / SSE   │  Components +          │
│ run viewer            │  ←—————→       │  client islands        │
└───────────────────────┘                └────────────────────────┘
```

## Skills layer

`skills/_shared/setup.md` is the single source of truth for "how does a
skill load config?". Every skill that needs the profile reads
`/api/health` first, then `GET /api/profile`, then for credentials hits
`GET /api/credentials`. Resume access goes through
`data.defaultResumeAbsolutePath` returned by the profile endpoint, or
`GET /api/resumes/[id]/file` for a stream.

`skills/_shared/auth.md`, `form-filling.md`, and `browser-tips.md`
describe the cross-cutting browser behaviors (login flows, mapping form
fields to profile fields, snapshot-vs-screenshot guidance, etc.).

The Humanizer is a git submodule at `skills/humanizer/` and is invoked
internally by the cover-letter and upwork-proposal skills.

## Web app layer

The web app is RSC-first. Most `app/<route>/page.tsx` files render a
`Container + Stack + PageHeader` server-side and descend into a
`*-content.tsx` client component for the data-fetching/interactive body.
Pages with a data-bound title bar (boards, application detail) keep
their headers inside the client component; everything else splits.

Routing/feature breakdown:

- **/** dashboard (KPIs, funnel, board breakdown, recent activity)
- **/applications** + **/applications/[id]** stage funnel + manual
  transitions, fuzzy duplicate matching feeding the dedupe API.
- **/runs** + **/runs/[id]** live viewer subscribes via
  `useRunEvents(runId)` to the SSE endpoint and invalidates the run
  detail query on every event.
- **/batch** queue management for the apply-batch skill.
- **/boards** CRUD for job boards.
- **/profile** 7-tab editor (Personal, Address, Work auth, EEO, Autopilot,
  Credentials, Resumes). One TanStack Form instance for the 5 form-driven
  tabs; Credentials and Resumes have their own queries.
- **/onboarding** 5-step wizard reusing the same tab components.

### API surface

All under `/api/`, JSON in/out, response shape `{ ok, data | error }`:

- `/api/health`
- `/api/profile` GET, PUT  •  `/api/profile/default-resume` POST
- `/api/job-boards` GET/POST  •  `/api/job-boards/[id]` PATCH/DELETE
- `/api/credentials` GET/POST  •  `/api/credentials/[id]` PATCH/DELETE
- `/api/resumes` GET/POST (multipart)  •  `/api/resumes/[id]` DELETE  •
  `/api/resumes/[id]/file` GET (stream)
- `/api/applied` GET/POST  •  `/api/applied/check` GET (URL exact +
  fuzzy title/company over 30-day window)  •  `/api/applied/[id]`
  GET/DELETE  •  `/api/applied/[id]/stage` POST  •
  `/api/applied/export.csv` GET
- `/api/dashboard/stats` GET
- `/api/runs` GET/POST  •  `/api/runs/[id]` GET/PATCH  •
  `/api/runs/[id]/jobs` GET/POST  •  `/api/runs/[id]/jobs/[jobKey]`
  PATCH  •  `/api/runs/[id]/events` POST + GET (SSE)  •
  `/api/runs/stats` GET
- `/api/batch` GET/POST  •  `/api/batch/pending` GET  •
  `/api/batch/[id]` PATCH/DELETE

### Prisma schema (multi-file)

`web/prisma/schema/` holds one file per domain — `base.prisma`,
`profile.prisma`, `resume.prisma`, `credential.prisma`, `job-board.prisma`,
`application.prisma`, `run.prisma`, `batch.prisma`. Prisma 7's modern
`prisma-client` generator emits TS into `web/src/generated/prisma/`.

The dev SQLite file is at `web/prisma/dev.db`. The driver adapter is
`@prisma/adapter-libsql` (rather than `better-sqlite3`) because the
better-sqlite3 native module fails to load under Bun on Windows.

### Fuzzy duplicate detection

`web/src/lib/matching.ts` implements Jaro-Winkler similarity on
normalized job title + company name (seniority and legal-suffix tokens
stripped). Title weighted 60%, company 40%, threshold ≥ 90, 30-day
rolling window. Pattern lifted from job-ops's
`applied-duplicate-matching.ts`.

### Live runs

`web/src/lib/sse.ts` is an in-process per-runId broker:
`Map<runId, Set<controller>>` with 15-second heartbeats. `/api/runs/[id]`
PATCH and `/api/runs/[id]/jobs/[jobKey]` PATCH publish events alongside
the DB write. The browser uses `EventSource` via the
`hooks/use-run-events.ts` hook, which invalidates the run detail query
on every event so the UI refetches the canonical state.

## Conventions

`CLAUDE.md` at the repo root holds the frontend rules: kebab-case files,
named exports (default only on `page.tsx`/`layout.tsx`), barrel MUI
imports, `interface` for `<Name>Props`, destructure props inside the
function body, no `useCallback`/`useMemo`/`memo`, prefer `&&` over
`: null` ternaries, Zod imports from `zod/v4`. The DTOs in
`web/src/types/api/`, the structured `queryKeys` in
`web/src/lib/api/query-keys.ts`, and the typed UI primitives under
`web/src/components/ui/{data,display,feedback,form,layout}/` are the
load-bearing reuse points.
