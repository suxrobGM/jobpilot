# Plan: API job sources, freehire.me first (issue #28)

Rewritten 2026-11-07 for the Feed, task-list and pipeline model. It replaces the 2026-08-21
campaign/agenda version.

## Context

The pilot finds jobs only through `search.discover`: the local agent browses a board with
Playwright, then a `feed.score` visit opens each posting to score it and write a brief. Both steps
cost tokens and time on every page. freehire.me exposes a key-free agent search API that returns
full descriptions, skills and enrichment for each hit, so the cloud can do discovery and scoring
itself. The local agent then only applies.

The design is a thin generic seam: a `JobSourceAdapter` interface, a code registry with one file
per provider, and freehire first. There is no declarative config engine.

## Gate: licence (before any code)

freehire's terms (updated 2026-10-28, "Data licence for API plans") say:

- Keyless use is personal and non-commercial only.
- Showing postings in a product offered to others needs an API plan.
- Raw data may not be redistributed or handed on to other services.
- When a plan ends, its postings stop showing.

JobPilot is multi-user and cloud-hosted, so it needs a partner plan or written permission from
the maintainer (asked on #28). Build nothing until that is settled. Whatever the answer, freehire
postings never reach the public `/jobs` listing index.

## Scope

- **In v1:** pilot search feeds whose board is an API source. The server runs them in place of
  `search.discover`.
- **Out of v1:** API boards in the manual terminal skills (`search`, `auto-apply`), a cron poller,
  structured facet mapping, freehire `direct_apply` postings, and freehire's match, tracking and
  CV endpoints.

## Provider facts (re-read from <https://freehire.me/openapi.yaml> on 2026-11-07)

- Endpoint: `GET https://freehire.me/api/v1/agent/jobs/search`, operationId `agentSearchJobs`.
  It returns full descriptions; `/jobs/search` truncates them.
- Auth: keyless. An optional `Authorization: Bearer fhk_…` key selects a plan's rate budget. The
  spec gives no limit numbers; it only mentions `429`.
- Paging: `limit` is 1-100. `offset + limit <= 10000`, else 400.
  The envelope is `{ data, meta: { total, limit, offset, ignored_params?, ignored_values? } }`.
- v1 params:
  - `q`
  - `description_format=markdown`
  - `sort=posted_at&order=desc`
  - `posted_within_days`
  - `visa_sponsorship=true`, only when the profile has `requiresSponsorship`. `false` means
    "states no sponsorship", not "unknown", so never send it.
- Unknown params and values are dropped silently. When `meta.ignored_params` or
  `meta.ignored_values` is present, log a warning.
- Hit fields:
  - Top level: `public_slug` (stable), `title`, `company`, `url` (empty when `direct_apply`),
    `location`, `work_mode`, `description`, `skills[]`, `posted_at`.
  - `enrichment`: `summary`, `employment_type`, `salary_min`, `salary_max`, `salary_currency`,
    `salary_period`, `experience_years_min`, `visa_sponsorship`.
  - Parse defensively: every field is optional. The spec's Job schema was read second-hand, so
    confirm it against a live response when writing the fixtures.
- Send `User-Agent: jobpilot (+https://github.com/suxrobGM/jobpilot)`.
- Coverage: about 4.9M jobs, mostly tech but not only tech. The setup agent chooses where a
  search runs.

## Key design decisions

- **Behavior keys off the code registry.** `isApiSourceDomain(domain)` decides everything, so
  `JobBoard` gets no `kind` column and there is no schema migration. The board API projects a
  computed `kind: "browser" | "api"` for the web and skills.
- **The freehire board is a data migration.** It inserts the `job_boards` row (`listed: true`,
  `isDefault: false`) plus a matching `DEFAULT_BOARDS` seed entry. It is not a code fallback.
- **A server run is the search run.** It deduplicates and saves rows as `pending` with
  `description`, `brief`, `matchScore` and `matchReason` already set. Those rows fall outside
  `NEEDS_WORKER_VISIT`, so `feed.score` never visits them. The next cycle's `settleScoredJobs`
  promotes them, and they surface as ordinary `job.apply` tasks. No new task type, payload or
  snapshot-shape change is needed.
- **Brief from the hit:**
  - `skills`: the hit's `skills[]`.
  - `requirements`: from `enrichment` when present.
  - `yearsExperience`: `enrichment.experience_years_min`.
  - `descriptionExcerpt`: the first 600 characters of the description.
  - The score comes from `ScoringService.scoreJobFit`, which is deterministic and needs no LLM.
- **Schedule:** reuse `FeedService.reportRun` and `scheduleNextRun`, so the empty-run ladder
  works unchanged.
  - Before launching, write a hold `nextRunAt = now + 10 min`. It outlives the 5-minute snapshot
    TTL, and server runs leave no `pilot_runs` row for the cooldown to see.
  - A provider error (network, 5xx, 429 after one `Retry-After`) sets `nextRunAt = now + 30 min`
    and journals a warning. It never steps `emptyRuns`.
- **Rotation:** `discoveryTasks` rotates `config.boards` over every due search. Filter API domains
  out of that list, and take API searches out of `dueQueries` before `buildTaskList`.
- **No public listing:** `JobListingPublisher.publish` skips jobs whose board domain is an API
  source. That one check covers all three `publishInBackground` call sites in `JobService`.
- **Dedupe:**
  - Key: `freehire-<public_slug>`.
  - Against the feed's own keys.
  - Against `recentPostingsWhere` by normalized URL.
  - Against `findFuzzyDuplicate` (title + company) over the 30-day applied window. A hit's `url`
    can be a publisher link, so the fuzzy match is the real guard.
  - Skip hits with `direct_apply` or no `url`.
- **Concurrency:**
  - A module-level in-flight set keyed by feed id.
  - At most 2 launches per refresh, and 4 concurrent requests per provider domain.
  - Task-list refresh never awaits the network.

## Milestone 1: board catalog

- New data migration: insert the FreeHire `job_boards` row (`domain: "freehire.me"`,
  `search_url: "https://freehire.me/jobs"`, `listed: true`, `sort_order` after the last board).
  Write the SQL and hold `db:migrate:apply` until the user confirms (db-migrate skill).
- `apps/api/prisma/seed/default-boards.ts`: matching entry.
- `packages/contracts/src/job-board.ts`: `jobBoardKindSchema = z.enum(["browser", "api"])`.
- `apps/api/src/modules/job-board/job-board.schema.ts`: add `kind` to the record, catalog and admin
  schemas. Elysia strips undeclared fields.
- `job-board.service.ts` and `admin-board.service.ts` projections set
  `kind: isApiSourceDomain(domain) ? "api" : "browser"`.

## Milestone 2: `modules/job-source/`

- `source-adapter.ts`: types only.
  - `SourceSearchParams { query, limit, postedWithinDays, visaSponsorship }`, using `null` for
    no value.
  - `SourcePosting { key, title, company, url, location, salary, employmentType, description,
    brief, postedAt }`.
  - `SourceSearchResult { postings, total, reachedEnd }`.
  - `JobSourceAdapter { domain, name, search(params) }`.
- `registry.ts` (+ test): `adapterByDomain`, `isApiSourceDomain`.
  - It stays free of Prisma and `@/env`, because pure task-list code and the publisher import it.
  - The optional `FREEHIRE_API_KEY` is read by the run service and passed into `search`.
- `providers/freehire.parse.ts` (pure, + test and fixtures, including a sparse-enrichment hit and
  a `direct_apply` hit):
  - A Zod hit schema with every field optional.
  - `toSearchQuery(params)`.
  - `toSourcePosting(hit)`: salary text from `enrichment`; returns `null` for unusable hits.
  - The offset clamp, with `reachedEnd` reflecting it.
- `providers/freehire.ts`:
  - A 10s `AbortSignal.timeout` per request.
  - A page loop with `limit = min(100, remaining)`.
  - On 429, honor `Retry-After` once, then return partial results.
  - On network failure or 5xx, throw `SourceUnavailableError`.
- `run-plan.ts` (pure, + test):
  - `postedWithinDays(lastRunAt, now)`: min 1, cap 30, `null` on the first run.
  - `runLimit()`: 50.
  - `splitNewPostings`, `holdUntil(now)`, `providerRetryAt(now)`.
- `job-source-run.service.ts` (`@injectable`):
  - `runSearch(userId, feedId)`:
    1. Load the feed (`kind: "search"`, live, with an API board).
    2. Read the profile's `requiresSponsorship`.
    3. Search, then dedupe.
    4. For each new posting: `scoreJobFit`, then `JobService.add` with the score, reason, brief
       and description.
    5. Call `FeedService.reportRun({ jobsScanned, newJobs, reachedEnd })`.
  - `launchDue(userId, searches)`: writes the holds, then runs fire-and-forget. On
    `SourceUnavailableError` it sets `providerRetryAt`.
- Tests are pure-unit only: no DB, no env.

## Milestone 3: pilot wiring

- `pilot/tasks/gather/searches.ts`: `DueSearch` already carries `board`. Add
  `splitApiSearches(due)` (pure, + test).
- `pilot/tasks/task-list.service.ts` `refresh`: inject `JobSourceRunService`. Hand the API due
  searches to `launchDue` and pass only the browser ones on to `buildTaskList`. There is no DI
  cycle, because the run service never imports the task list.
- `pilot/tasks/build.ts` `discoveryTasks`: drop API domains from the `config.boards` rotation
  (+ case in `tasks.searches.test.ts`).
- `search.setup` payload: its `boards` list stays `string[]`. The setup skill doc explains API
  boards (milestone 5).
- Journal one line per server run (added, skipped, duplicates) so the thread shows the work.

## Milestone 4: listing guard + web

- `job-listing/publishing/job-listing.publisher.ts`: skip API-source board domains (+ test).
- `components/features/boards/boards-section.tsx`: an "API" chip, and no login or credential
  action, for API boards.
- `pilot/goals/searches-section.tsx` and `home/side/searches-summary.tsx`: an API variant of the
  board chip.
- Admin `boards` table: a read-only Kind column.
- DTO types come from Eden inference.

## Milestone 5: plugin

- `plugin/skills/pilot/` setup docs: API boards (FreeHire) run on the server, cover mostly tech
  roles, and suit broad tech queries. A search on one never shows up as `search.discover`.
- `search/SKILL.md` and `auto-apply/SKILL.md`: when the resolved board has `kind == "api"`, stop
  and tell the user API boards run as pilot searches.
- `_shared/` campaign flow doc: a short "API sources" note.
- Regenerate `.codex/agents/*.toml` if any `plugin/agents` file changes.

## Milestone 6: docs

- `docs/roadmap/`: an `api-job-sources` entry plus a README row. List the follow-ups: manual skill
  support, facet mapping (`work_mode`, `seniority`, `countries`, `collections=us-h1b-sponsor`,
  `reality=fresh`), more providers, and a cron poller.
- `README.md` boards line and `docs/architecture.md` discovery flow: API sources are fetched and
  scored in the cloud, and the local agent only applies.
- Reference #28 in the commits. CHANGELOG is left to the release skill.

## Execution

- Branch `feat/api-job-sources` from `main`, created only after the licence gate clears.
- One branch, no PRs. Run `verify` and then the `commit` skill after each milestone.
- Dry-run the migration on a prod dump (`:5434`) before applying it.

## Risks

- **Licence terms change or the plan lapses:** the registry entry is the kill switch. Removing it
  turns the board back into an inert browser row, so a follow-up data migration deletes the row
  and its jobs' listings.
- **Downtime or 429:** timeouts, typed errors, a 30-minute retry, and no ladder step.
- **Schema drift on freehire's side:** all-optional parsing, plus logged `ignored_params`.
- **Thin hits:** a hit with zero skills still saves but scores low, and `settleScoredJobs` skips it.

## Verification

1. The `verify` gate.
2. Migration dry run on the prod dump, then `db:migrate:apply` after confirmation. Then
   `GET /api/job-boards` shows FreeHire with `kind: "api"`.
3. Dev E2E (`bun run dev`):
   - Have setup create a FreeHire search, or create one through a pilot change.
   - It never appears as a `search.discover` task.
   - Rows land as pending with scores, then turn approved or skipped next cycle, and `job.apply`
     tasks follow.
   - `lastRunAt`, `emptyRuns` and `nextRunAt` update.
4. With the provider blocked (bad host), the 30-minute retry fires and `emptyRuns` is unchanged.
5. No freehire posting appears in the public `/jobs` index.
