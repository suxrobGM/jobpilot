# Plan: Generic API job-source adapter, freehire.me first (issue #28)

## Context

GitHub issue #28: the freehire.me maintainer proposes it as a job source. Its search API is
public and key-free, returns full descriptions per hit, filters on visa sponsorship, and links
to the employer's own ATS. JobPilot discovers jobs only through agent-driven Playwright browsing
today, which costs tokens and time per page.

We build a thin generic seam: a `JobSourceAdapter` TypeScript interface with a code registry,
one file per provider, freehire as the first. The server fetches, dedupes, scores
(`ScoringService.scoreJobFit`, deterministic, no LLM), and saves jobs. The local agent only
applies. No declarative config engine.

User decisions:

1. Demand-driven only. Runs happen on campaign creation/resume and during pilot agenda refresh.
   No cron poller in v1.
2. API sources are `JobBoard` rows with `kind = "api"`, shown in the existing /boards UI with an
   "API" chip. No separate Sources page.
3. Work happens on a new branch, and public docs get updated.

## Execution process

- Create branch `feat/api-job-sources` from `main` before any change.
- Implement milestone by milestone, in order.
- After each milestone: run the /verify gate, then commit (subject only, no co-author trailers).
- The migration in milestone 1 touches the remote DB through the tunnel. Create the SQL on the
  branch but hold `db:migrate:apply` until the user confirms, since the database is shared.

## Provider facts (verified against <https://freehire.me/openapi.yaml>)

- Use `GET https://freehire.me/api/v1/agent/jobs/search` (full descriptions via
  `description_format=markdown`). The plain `/jobs/search` truncates.
- Rate limits: 600 req/min shared, 300 req/min on the agent endpoint, 429 + `Retry-After`.
- Free-text `q` param plus facet filters. `visa_sponsorship` boolean. `posted_within_days`.
  `limit` max 100, `offset + limit <= 10000`.
- Hit shape: `public_slug` (stable key), `url`, `title`, `company`, `location`, `description`,
  `skills[]`, `posted_at`, sparse `enrichment{requirements[], ...}`. Parse defensively, all
  optional. `url` can be a publisher link, so fuzzy dedupe matters.
- Do not use freehire's match/tracking/CV endpoints. IT roles only.

## Key design decisions

- `kind` is a Prisma enum `JobBoardKind { browser, api }` on `JobBoard`, default `browser`.
- freehire seed row: `listed: true`, `isDefault: false` (IT-only, users adopt it), `kind: api`.
- Run endpoint is campaign-scoped: `POST /api/job-sources/runs {campaignId}`. The campaign
  already carries query, board, minScore, maxJobs, resumeId. Pilot calls the service directly.
- Behavior keys off the code registry (`isApiSourceDomain`), not the DB `kind`. The DB field is
  UI metadata. The run endpoint returns 409 when the board has no adapter.
- Server-found applied-duplicates are counted in the run summary, not persisted as skipped rows.
- `auto_apply` campaigns promote inline via `CampaignJobService.promoteScoredJobs`; `search`
  campaigns stay `pending` for the normal review flow.
- Pilot API runs are fire-and-forget with a `nextRunAt` lease (now + 10 min, written before
  launch, overwritten by `reportRun`). Crash-safe, no new claim kind, survives the 5-min agenda
  snapshot TTL.
- Provider errors set `nextRunAt = now + 30min` directly and journal a warning. They never step
  the empty-run backoff ladder, which stays a signal-quality mechanism.
- No new agenda item kind. New jobs surface as normal `job.apply` items next cycle, so
  `agendaClaimFieldsSchema` and `AGENDA_KIND_LABELS` stay untouched.
- `config.boards` rotation applies to browser boards only; API domains are filtered out of the
  rotation list, and API searches always run their own board.
- freehire query mapping v1: `q`, `posted_within_days`, `visa_sponsorship`,
  `sort=posted_at&order=desc`. Structured facet params deferred (that is the config-engine trap).
- Send `visa_sponsorship=true` only when `user.requiresSponsorship`. Never send `false`, which
  would exclude unknown postings the browser flow would still consider.

## Milestone 1: schema, migration, seed, board contracts

- `apps/api/prisma/schema/job-board.prisma`: add enum `JobBoardKind { browser, api }`
  (`@@map("job_board_kind")`) and `kind JobBoardKind @default(browser)` on `JobBoard`.
- Migration (per db-migrate skill: `db:migrate` create-only, hand-review, `db:migrate:apply`,
  `db:generate`; never reset). SQL:
  `CREATE TYPE "job_board_kind" AS ENUM ('browser','api');`
  `ALTER TABLE "job_boards" ADD COLUMN "kind" "job_board_kind" NOT NULL DEFAULT 'browser';`
  No pilot_states snapshot nulling: the agenda wire shape is unchanged.
- `apps/api/src/modules/job-board/default-boards.ts`: append
  `{ name: "FreeHire", domain: "freehire.me", searchUrl: "https://freehire.me/jobs", kind: "api", sortOrder: 12 }`.
- `apps/api/prisma/seed/job-boards.ts`: include `kind` in the upsert `update` clause.
- `packages/contracts/src/job-board.ts`: add `jobBoardKindSchema = z.enum(["browser","api"])`;
  add `kind` to `adminBoardSchema` only (users never set it; the domain upsert in
  `JobBoardService.create` preserves kind on adoption).
- `apps/api/src/modules/job-board/job-board.schema.ts`: add `kind` to `jobBoardRecordSchema`,
  the catalog item schema, and `adminBoardRecordSchema`. Elysia strips undeclared fields, so
  forgetting this hides the field from web and skills.
- `job-board.service.ts` `project()` and `catalog()` select, plus `admin-board.service.ts`
  projections, pass `kind` through.

## Milestone 2: contracts + new `modules/job-source/`

- New `packages/contracts/src/job-source.ts` (+ test): `jobSourceCapabilitiesSchema`
  `{visaFilter, fullDescriptions, salaryFilter, facets}`, `runJobSourceSchema {campaignId}`.
- New module `apps/api/src/modules/job-source/` following the add-api-route conventions:
  - `source-adapter.ts`: types only. `SourceSearchParams {query, limit, postedWithinDays?,
    visaSponsorship?}`, `SourcePosting {key, title, company, url, location, salary,
    employmentType, description, digest, postedAt}`, `SourceSearchResult {postings, total,
    reachedEnd}`, `JobSourceAdapter {domain, name, capabilities, search()}`.
  - `registry.ts` (+ test): `ADAPTERS`, `adapterByDomain`, `isApiSourceDomain`, `listSources`.
    Must stay free of Prisma and `@/env` imports (pilot pure code and tests import it).
  - `providers/freehire.parse.ts` (pure, + test + fixtures incl. a sparse-enrichment hit):
    Zod hit schema all-optional; `mapParams`; `toSourcePosting` (digest: skills from top-level
    `skills[]`, requirements from `enrichment.requirements[].text`, excerpt capped 600 chars);
    pagination clamp to the 10k offset cap with `reachedEnd` reflecting it.
  - `providers/freehire.ts`: the adapter. 10s `AbortSignal.timeout` per request, page loop
    `limit = min(100, remaining)`, honor `Retry-After` once then bail with partial results,
    typed `SourceUnavailableError` on network/5xx.
  - `run-plan.ts` (pure, + test): `deriveRunLimit` (default 50, cap 100),
    `derivePostedWithinDays(lastRunAt, now)` (min 1, cap 30, undefined on first run),
    `splitNewPostings` (key + canonical-URL dedupe against existing campaign rows),
    `apiSearchLease` / `providerRetryAt` helpers, `summarizeFit`.
  - `job-source-run.service.ts` (@singleton; value imports for tsyringe):
    `runForCampaign(userId, campaignId, opts? {pilotSearchId?, postedWithinDays?})`:
    ensure owned campaign, resolve adapter or 409, per-campaign and per-domain (4) concurrency
    slots, load `user.requiresSponsorship`, `adapter.search`, dedupe against campaign rows
    (`splitNewPostings`) and applied duplicates (load the 30-day window once, then in-process
    `canonicalizeJobUrl` set + `findFuzzyDuplicate` from `modules/application/`), then per new
    posting: `scoreJobFit` then `campaignJobs.addJob` as `pending` (fires SSE and
    `publishInBackground` for free). For `auto_apply` campaigns call `promoteScoredJobs`.
    If `opts.pilotSearchId`, call `pilotSearches.reportRun`. Return summary
    `{campaignId, board, total, fetched, added, duplicateApplied, duplicateExisting, approved,
    skippedLowScore, reachedEnd}`. Also `launchPilotRuns` (milestone 4).
  - `job-source.schema.ts`: `jobSourceListSchema`, `jobSourceRunResultSchema` (explicit Zod).
  - `job-source.controller.ts` prefix `/job-sources`, authGuard: `GET /` (registry list),
    `POST /runs` with `rateLimit(RATE_LIMITS.jobSourceRun)`.
- `apps/api/src/common/rate-limit/policies.ts`: new `jobSourceRun` policy (~6/min per user).
- `apps/api/src/app.ts`: `.use(jobSourceController)` on its own line.
- Tests are pure-unit only (no DB, no env), importing modules directly.

## Milestone 3: campaign wiring (web submit + resume)

- `apps/web/src/components/features/campaigns/constants.ts`: `isApiBoard(boards, domain)`.
- `composer/campaign-composer.tsx`: when the board is API kind, pin mode to search/auto-apply
  (Upwork-pin precedent), and on submit create the campaign, navigate to detail, run
  `api["job-sources"].runs.post({campaignId})` via `useApiMutation` (errors surface as toast,
  SSE streams rows into the detail page), and skip `agent.injectSkill`. Exception: auto-apply
  mode with the agent online injects `resume-campaign` after the run to drain approved rows.
- `composer/campaign-basics-fields.tsx`: " (API)" suffix on API board labels.
- `detail/actions-bar.tsx` resume: for API-board campaigns call the run endpoint first (works
  with the agent offline), then inject `resume-campaign` only if the agent is available.
- `detail/header-card.tsx`: API variant on the board chip.
- New DTO types come from Eden `Data<>`/`Body<>` inference, never hand-written.

## Milestone 4: pilot integration

- `apps/api/src/modules/pilot/agenda/types.ts` + `gather-jobs.ts`: carry `lastRunAt` on
  `AgendaDueQuery` (server-internal only).
- `items-jobs.ts` `buildDiscoverItems`: filter API domains out of the `config.boards` rotation
  list via `isApiSourceDomain` (registry import is pure). Add a test case.
- `agenda/service.ts` refresh: split `dueQueries` into API and browser. Pass only browser ones
  to `buildAgenda`. For API ones call `this.jobSourceRuns.launchPilotRuns(userId, apiDue,
  config)` (inject `JobSourceRunService`; no DI cycle, it never imports `AgendaService`).
- `launchPilotRuns`: awaited part is DB-only and fast. For up to 2 due searches not in the
  module-level in-flight set, write the lease with a direct
  `prisma.pilotSearch.update({nextRunAt: apiSearchLease(now)})` (not via `PilotSearchService`,
  whose `nullAgenda` would invalidate the snapshot being built). Then fire-and-forget:
  reuse `q.campaignId` or create the pilot campaign row (`source: "auto_apply"`,
  `createdBy: "pilot"`, `pilotSearchId`), then `runForCampaign(..., {pilotSearchId,
  postedWithinDays: derivePostedWithinDays(q.lastRunAt, now)})`. `reportRun` inside it sets the
  real ladder schedule and nulls the snapshot, so the next cycle gathers the approved rows as
  `job.apply` items. On `SourceUnavailableError`: `nextRunAt = providerRetryAt(now)` without
  touching `emptyRuns`, plus a pilot journal warning.
- No `PilotSearch` schema change. `scheduleNextRun` untouched.
- Pure test asserts the lease (10 min) outlives the snapshot TTL (5 min).

## Milestone 5: web boards + pilot UI

- `boards/boards-content.tsx`: "API" chip beside the name, "-" in the Email cell for API rows.
- `boards/board-form-dialog.tsx`: optional `kind` prop; for `"api"` show only name/sortOrder.
- `boards/add-board-button.tsx`: minimal catalog adoption. New `jobBoardQueries.catalog()` +
  query key; show unlinked listed boards as quick-add entries (POST by name/domain; the domain
  upsert links and preserves kind). Free-form dialog stays as fallback.
- Admin `components/features/admin/boards/`: Kind column/chip in `boards-table.tsx`, kind Select
  in `board-form-dialog.tsx` (create only), wire through mutations.
- Pilot: `instructions/searches-list.tsx` board chip gets the API variant; `boards-section.tsx`
  adds helper text "API boards run server-side and are excluded from board rotation";
  `agenda-preview.tsx` untouched.

## Milestone 6: plugin

- New `plugin/skills/api-search/SKILL.md`: thin, no browser. Resolve board via
  `GET /api/job-boards`, require `.kind == "api"`, create or reuse the campaign, call
  `POST /api/job-sources/runs`, print the summary and the web link. With `--auto-apply`, run the
  standard apply loop over `approved` rows per `_shared/campaign-flow.md`.
- `search/SKILL.md` and `auto-apply/SKILL.md`: after board resolution, if `.kind == "api"`,
  call the run endpoint and skip the browser discovery phases (auto-apply then applies the
  server-approved rows).
- `_shared/campaign-flow.md`: short "API sources" section (kind field, run endpoint, server
  does discovery/scoring/dedupe, skills only apply).
- `pilot/SKILL.md`: one line noting API searches never appear as `search.discover` items.

## Milestone 7: docs

- `docs/roadmap/`: add an `api-job-sources` entry per the folder convention and a row in
  `docs/roadmap/README.md`, listing follow-ups: facets-driven structured filters, more
  providers, salary filter mapping, cron poller.
- `README.md`: extend the boards line ("Point it at LinkedIn, Indeed, ... or add your own
  board", line 42) to mention API sources like FreeHire that need no login or browser, and add
  a note in the dashboard-actions table that API-source campaigns run server-side.
- `docs/architecture.md`: in the "what a campaign does" flow (line 85 area, "It opens a browser
  ... and searches the job board"), add a short paragraph on API sources: the cloud fetches and
  scores them directly, the local agent only applies. Mention the job-source module if the doc
  lists modules.
- `plugin/README.md`: add `api-search` to the skill list.
- Reference issue #28 in the PR description. Changelog stays untouched; the release skill owns
  it at release time.

## Risks and edge cases

- freehire downtime or 429: timeouts and typed errors; agenda refresh never awaits network;
  composer surfaces the error as a toast and the campaign can be re-run via resume.
- Rate budget: one run is 1-2 requests (limit <= 100 per page) against a 300 req/min cap.
- Offset cap 10k: clamped in parse; `reachedEnd` reflects it so backoff kicks in.
- IT-only scope: zero-hit queries ride the existing empty-run ladder; composer helper text
  sets expectations.
- Publisher/affiliate URLs: fuzzy title+company dedupe and the listing `dedupeKey` are the real
  guards, not canonical URLs.
- Sparse enrichment: all-optional parse schema; zero-skill hits still become campaign jobs but
  are rejected by `buildListingDraft`'s quality gate.
- Elysia strips undeclared response fields: declare `kind` and run-result fields everywhere.
- Registry and adapters must not import Prisma or `@/env`; tsyringe needs value imports.

## Verification

1. `/verify` gate: Biome, API + web typechecks, API and contracts tests (all new tests DB-free).
2. Migration: `db:migrate` create-only, review SQL, `db:migrate:apply` (after user confirms),
   `db:generate`, `db:seed` (expect 12 boards).
3. Swagger in dev: `GET /api/job-sources`, `POST /api/job-sources/runs`, `kind` on
   `/api/job-boards`.
4. Manual E2E (`bun run dev`): adopt FreeHire on /boards (API chip, no credential fields);
   create an auto-apply campaign on freehire.me ("react developer"); watch rows stream in as
   pending then approved/skipped with scores; confirm freehire listings appear in the public
   /jobs index.
5. Pilot: a PilotSearch on freehire.me produces no `search.discover` item; jobs land
   server-side; ladder fields update; kill the API mid-run and confirm the 10-min lease retry.
6. Plugin smoke: `/api-search "typescript backend" --board freehire.me --max-jobs 20` with the
   web agent closed.
