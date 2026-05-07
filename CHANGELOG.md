# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-05-07

The whole state layer moved out of JSON/text files at the plugin root and
into a local Next.js + SQLite web app at `http://127.0.0.1:8000`. Skills
now drive the app via `curl`. The `scripts/`, `applied-jobs.json`,
`runs/*.json`, `profile.json`, `profile.example.json`,
`jobs-to-apply.txt`, and `jobs-to-apply.example.txt` are gone. **Run the
web app before running any skill.**

### Added

- **`web/`** — Bun + Next.js 16 (App Router, RSC, typed routes) + MUI 9 +
  Prisma 7 (`prisma-client` generator, `@prisma/adapter-libsql` adapter
  for Bun-on-Windows compatibility) + TanStack Query 5 + TanStack Form 1
  + Zod v4. Bound to `127.0.0.1:8000` with no auth (single-user local
  tool).
- **Themed MUI** module under `web/src/theme/` with split palette /
  tokens / typography / per-component overrides, plus a custom
  `MuiSvgIcon` `fontSize` size scale (`xs|sm|md|lg|xl|xxl|2xxl`) so no
  page hard-codes pixel sizes.
- **App shell** (`components/layout/`) with sticky sidebar nav driven
  by a single `shell-config.ts` (active-route highlight via
  `usePathname`).
- **UI primitives** under `components/ui/{data,display,feedback,form,layout}/`
  including a generic `<SelectFilter<TValue>>`, a `DataTable` wrapper
  around MUI X DataGrid, a `StageChip` for the application funnel, and
  eight TanStack-Form-bound MUI fields (`form-text-field`,
  `form-select-field`, `form-switch-field`, `form-toggle-field`,
  `form-checkbox-field`, `form-multiselect-field`,
  `form-file-upload-field`, `form-section`).
- **Pages**: `/` (dashboard), `/applications` + `/applications/[id]`
  (DataGrid + filters + detail with stage timeline), `/runs` +
  `/runs/[id]` (live SSE viewer), `/batch` (URL queue), `/boards`
  (CRUD), `/profile` (7-tab editor), `/onboarding` (5-step wizard
  reusing the same tab components). Header chrome is server-rendered;
  data-fetching/interactive bodies are client.
- **API surface** under `/api/`: `/health`, `/profile` GET/PUT,
  `/profile/default-resume` POST, `/job-boards` CRUD, `/credentials`
  CRUD, `/resumes` GET/POST/`[id]`/`[id]/file`, `/applied` GET/POST,
  `/applied/check` (URL exact + fuzzy title+company over 30-day window),
  `/applied/[id]` GET/DELETE, `/applied/[id]/stage` POST,
  `/applied/export.csv` GET, `/dashboard/stats` GET, `/runs` CRUD,
  `/runs/[id]/jobs` CRUD, `/runs/[id]/jobs/[jobKey]` PATCH,
  `/runs/[id]/events` POST + GET (SSE), `/runs/stats` GET, `/batch`
  GET/POST, `/batch/pending` GET, `/batch/[id]` PATCH/DELETE.
- **Multi-file Prisma schema** under `web/prisma/schema/` — one file per
  domain (`base`, `profile`, `resume`, `credential`, `job-board`,
  `application`, `run`, `batch`).
- **Fuzzy duplicate matching** (`web/src/lib/matching.ts`) — Jaro-Winkler
  on normalized title + company (seniority + legal-suffix tokens
  stripped); 60/40 weighted score; threshold 90; 30-day rolling window.
  Pattern adapted from `job-ops/applied-duplicate-matching.ts`.
- **In-process SSE broker** (`web/src/lib/sse.ts`) — per-runId
  `Map<string, Set<controller>>` with a 15s heartbeat. `PATCH` to runs
  or run-jobs publishes `status` / `progress` / `job-update` events.
- **`useRunEvents(runId)` hook** opens an `EventSource` and invalidates
  `queryKeys.runs.detail(runId)` on every event so the live viewer at
  `/runs/[id]` reflects every state change in real time.
- **Stage funnel for applications**: `applied → recruiter_screen →
  assessment → hiring_manager_screen → technical_interview → onsite →
  offer / rejected / withdrawn`. Each transition writes a `StageEvent`
  row; the application detail page renders the timeline.
- **`skills/_shared/setup.md`** rewritten as the single source of truth
  for "load profile/resume/credentials" via the API.
- **Frontend conventions** documented in repo-root `CLAUDE.md`:
  kebab-case files, named exports (default only on `page.tsx`/
  `layout.tsx`), barrel MUI imports, `interface` for `<Name>Props`,
  destructure props inside the function body, no
  `useCallback`/`useMemo`/`memo`, prefer `&&` over `: null` ternaries,
  Zod imports from `zod/v4`.

### Changed

- All remaining skills (`apply`, `apply-batch`, `autopilot`, `search`,
  `cover-letter`, `interview`, `upwork-proposal`) rewritten to call the
  JobPilot API via `curl`.
- `apply-batch` no longer takes a file path argument; it consumes URLs
  from `/api/batch/pending` (managed via the `/batch` page in the web
  UI). Each entry is PATCHed to `consumed` after a successful apply.
- `autopilot` resume-mode lists incomplete runs via
  `GET /api/runs?status=in_progress`; per-job status changes during
  the apply loop are PATCHes that emit SSE events for the live viewer.
- `_shared/form-filling.md` field paths rewritten as `data.profile.*`
  (flat schema) and `data.autopilot.*`. EEO answers default to "Prefer
  not to disclose" when null.
- `CLAUDE.md` moved from `.claude/CLAUDE.md` (gitignored) to the repo
  root.
- `.claude/settings.json` adds explicit `Bash(curl:*)`, `Bash(jq:*)`,
  `Bash(date:*)` allow entries.

### Removed

- `scripts/{check-applied,log-applied,update-run,run-stats,export-csv,_ensure-jq}.sh`
  — replaced by `/api/applied/check`, `/api/applied`,
  `/api/runs/[id]/jobs/[jobKey]` PATCH, `/api/runs/stats`,
  `/api/applied/export.csv`.
- `applied-jobs.json` (now the `Application` table).
- `runs/*.json` (now `Run` + `RunJob` + `RunEvent` tables, with SSE
  events instead of file polling).
- `profile.json`, `profile.example.json` (now `Profile` +
  `AutopilotSettings` rows; first-run users hit the onboarding wizard
  at `/onboarding`).
- `jobs-to-apply.txt`, `jobs-to-apply.example.txt` (now `BatchInput`
  rows, managed at `/batch`).
- `dashboard` skill — superseded by the web dashboard at
  `http://127.0.0.1:8000/`. Use the browser; the per-skill text summary
  was redundant.
- `docs/configuration.md` (replaced by `docs/self-hosting.md`).
- `docs/how-it-works.md` (replaced by `docs/architecture.md`).

## [1.3.0] - 2026-03-24

### Added

- `apply-batch` skill for applying to multiple jobs from a file of URLs with scoring and batch approval
- `jobs-to-apply.example.txt` template file for batch apply

## [1.2.0] - 2026-03-22

### Added

- Persistent applied-jobs database (`applied-jobs.json`) to prevent duplicate applications across runs and skills
- `scripts/check-applied.sh` to check if a job URL was already applied to
- `scripts/log-applied.sh` to log successful applications to the database
- Relocation preferences (`willingToRelocate`, `preferredLocations`) in work authorization config
- Strengthened `browser_snapshot` guidance to always use `ref` parameter for targeted snapshots

### Changed

- All shell scripts now use `jq` only (removed `node` and `python3` fallbacks) for simpler permissions
- Improved context window efficiency with targeted browser snapshots

## [1.1.0] - 2026-03-22

### Added

- `dashboard` skill for application tracking stats and CSV export
- Multi-resume support (`personal.resumes` in profile.json)
- Salary range filter (`minSalary`/`maxSalary` in autopilot config)
- Smart retry with `retryNotes` on failed applications for better retry strategies
- `scripts/run-stats.sh` for aggregating stats across runs
- `scripts/export-csv.sh` for exporting applications to CSV

## [1.0.0] - 2026-03-21

### Added

- Initial release of JobPilot plugin
- `apply` skill for automated job application form filling via Playwright
- `cover-letter` skill for generating tailored cover letters
- `upwork-proposal` skill for generating Upwork proposals
- `search` skill for searching and ranking job board results
- `interview` skill for generating interview prep Q&A
- `humanizer` submodule integration for natural tone rewriting
- Profile system with `profile.json` for storing personal info and credentials
- Job board configuration support (LinkedIn, Indeed)

- `autopilot` skill for autonomous batch job applications
- Progress tracking in `runs/` directory with resumable JSON files
- Autopilot configuration section in `profile.json` (minMatchScore, maxApplicationsPerRun, skipCompanies, skipTitleKeywords, defaultStartDate)
- Resume and retry-failed support for interrupted or failed autopilot runs
