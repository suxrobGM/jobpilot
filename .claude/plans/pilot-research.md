# Plan: Standing pilot campaigns + research (pilot task `research.explore` and manual campaigns)

## Context

Discovery today runs on boards only. `search.setup` turns goals into queries, and `search.discover`
rotates them across boards the user configured by hand. Postings that never reach those boards are
missed, chiefly university and research-institute portals (Workday, PeopleAdmin, Interfolio) and
lab pages. Those are exactly the research-assistant, university and H-1B cap-exempt roles the
user wants.

This adds a free-roam research task. From the goals, an agent searches the open web for
**postings**, reads and scores each one, and saves it to the research campaign. Approval and
applying then run through the existing promote → `job.apply` path. Research also names niche
boards worth adding to the normal search rotation, and tags jobs whose employer is H-1B
cap-exempt. A profile preference ranks those jobs higher in the apply order.

Pilot campaigns pile up today, and research would make it worse:

- `inbox.jobAlerts` creates a new `"Job alerts · <time>"` campaign on every run, and runs happen
  at each scheduled hour.
- `search.discover` reuses a search's campaign only while it is `in_progress`.
  `finalizeIdleCampaigns` (`pilot/tasks/maintenance.ts:172`) completes any campaign 10 minutes
  after it runs out of active jobs, and searches rerun every 2-8 hours. So each search opens a fresh
  campaign most runs. `gather-searches.ts` already notes that a search can have several.

Milestone 1 fixes this for every pilot feed before research lands: one standing campaign per
feed, never closed just for being idle.

User decisions:

- Lean v1. Research finds postings directly. There is no watched-employer list, no ATS feed
  adapters and no server-side fetching. Employer watching can come back in v2 if research keeps
  rediscovering the same employers. For tech roles, LinkedIn, Indeed and hiring.cafe already index
  the Greenhouse, Lever and Ashby postings.
- Cap-exempt is in v1: a per-job basis with an evidence link, plus a profile preference.
- PhD programs are out of scope (their own plan later). Research saves job postings only.
- Freehire stays in `.claude/plans/api-job-sources.md`, which is stale and gets rewritten later.
  Don't touch it.
- Pilot campaigns are standing, one per feed. This fixes job alerts and search too, not only
  research.
- Research is also a manual campaign: "Anywhere on the web" is a board choice in the composer,
  not a fifth mode, so it works with both Search only and Auto-apply.

Standing constraints:

- The pilot stays in the TUI, and the agent uses `model: inherit`.
- No browser playbooks. Research is agent-driven.
- No token budget. Stop conditions exist to prevent wandering, not to save spend.
- Null over undefined. No inline object types in signatures. Files stay under ~250 lines.
- No compat shims: existing piled-up campaigns are handled by a data migration.

## Execution

- Branch `feat/pilot-research` from `main`. Run `verify` and then the `commit` skill after each
  milestone. Milestone 1 stands alone and can ship before the rest.
- Milestones 1 and 2 each have a migration against the shared remote DB. Write the SQL on the
  branch, but hold `db:migrate:apply` until the user confirms (db-migrate skill; compare pg_dump,
  not migrate diff).

## Key design decisions

- **Standing campaigns.** A pilot feed keeps one open (`in_progress` or `paused`) campaign and
  reuses it on every run:
  - A pilot search's campaign is keyed by `pilotSearchId`, as today.
  - Job alerts and research are keyed by a new `Campaign.feed` (`job_alerts | research`).
  - Partial unique indexes enforce one open campaign per key, so a race or a stale payload can't
    fork a second one.
  - `POST /api/campaigns` with `feed` or `pilotSearchId` is get-or-create. It returns the open
    campaign when one exists. Task docs stop carrying "never open a second campaign" logic.
  - `finalizeIdleCampaigns` skips standing campaigns while their feed is live. A feed ends when:
    - its search is deleted (`pilotSearchId` is set to null, and the campaign drains like any other);
    - job alerts are turned off;
    - goals change with `completeCampaigns` (existing `retire()` path).
  - Pausing a standing campaign pauses its feed. The feed's task isn't offered while it's paused.
    "Run now" on alerts or research resumes it.
  - The campaign's `config.minScore` stays fixed after creation, because `campaign.tune` owns it.
    `config.resumeId` is refreshed when the get-or-create body names a different resume, so the
    scorer and `job.apply` keep using the same resume after a primary-resume change.
- **One task, one agent.** The task is `research.explore`; the new agent `job-researcher` sits
  beside `job-searcher` and `job-scorer`. It scores in place the way `job-searcher` does:
  build the brief per `_shared/job-brief.md`, `POST /api/score-fit`, then save as `pending` with
  `matchScore` and `brief`. `promoteScoredPendingJobs` (`pilot/tasks/maintenance.ts:137`)
  promotes the rows on the next task list. No changes to the scorer or the promote path.
- **The research campaign** is the standing `feed: "research"` campaign, named `"Research"`, with
  `source:"auto_apply"`, `createdBy:"pilot"`, `config {resumeId, minScore}` and no board. The run
  summary carries the topic, not the campaign name. Each job's `board` is its posting host, which
  `boards.resolveId` turns into an unlisted catalog row. Job alerts already works this way.
- **Dedupe**, cheapest first:
  1. **Employer URL first.** When a hit is an aggregator or mirror (HigherEdJobs, Indeed,
     LinkedIn), the agent follows its apply link to the employer's own posting and saves that URL.
     Mirrors then share one URL, so the URL checks below catch them. It falls back to the mirror
     only when the employer page needs a login or can't be found.
  2. **URL seen.** `POST /api/pilot/job-alerts/seen` (`job-alerts.service.ts:131` `seenUrls`) gets
     a new optional `withinDays` body field (default 7, max 90). Research sends 30.
  3. **Similar posting.** New `POST /api/pilot/jobs/similar` catches the same posting under a
     different URL in any campaign:
     - It takes up to 100 `{title, company, location?}` and `withinDays` (default 30, max 90).
     - It returns `{matches: [{index, campaignId, key, title, company, location, url, status}]}`.
     - It reuses `findFuzzyDuplicate` (`scoring/applied-duplicates.ts`) over the user's campaign
       jobs in the window, skipped rows included, so a skipped posting stays skipped.

     A match is a hint, not a verdict: universities post many same-title roles ("Research
     Assistant", one university, different labs). The agent skips as a duplicate only on the same
     requisition id, or the same title, location and lab or department.
  4. **Applied and in-campaign.** `GET /api/applied/check`, then `409 DUPLICATE_JOB`. With a
     standing campaign, `DUPLICATE_JOB` now catches a key repeated across all research runs.

  Job alerts adopts step 3 as well (the same job arrives from LinkedIn and Indeed alerts).
- **Cap-exempt belongs to the job, judged by the agent.**
  - New `CampaignJob.capExemptBasis` (enum `university | university_affiliate |
    nonprofit_research | government_research`) and `CampaignJob.capExemptEvidenceUrl`.
  - The agent sets a basis only when it has evidence: a `.edu` employer, or a nonprofit or
    government research page.
  - It never changes `matchScore` or eligibility.
- **Ranking.** When the new `Profile.preferCapExempt` is true and a job has a basis, `applyTask`
  (`pilot/tasks/build.ts:77`) adds +10 to the `job.apply` boost, and the research payload tells
  the agent to favour cap-exempt employers.
- **Board suggestions stay suggestions.** The agent returns `boardsSuggested`, and the summary
  names them. It never edits `config.boards` or links boards: those are user instructions.
- **When it runs.** A once-per-user damper, in the `search.setup` pattern:
  - `requested`: "Research now" was clicked (`PilotState.researchRequestedAt`, the
    `jobAlertsRequestedAt` pattern). Pushed ungated.
  - `initial`: no research run yet. Goals changes reset this, because `retire()` deletes the runs.
  - `dry`: the user has at least one search, and more than half of them are backing off
    (`emptyRuns >= 3`). 24h cooldown. Never fires with zero searches, because `search.setup` comes
    first then.
  - `periodic`: 7 days.

  Every trigger except `requested` goes in `build.ts`'s `isPipelineQuiet` block. None fires while
  the research campaign is paused. Priority 450: below `search.discover` (500), above
  `campaign.tune` (350).
- **Stop conditions:** the agent stops at whichever comes first:
  - `newJobsTarget` new pending rows (clamped 5-20, the same clamp as discovery);
  - 5 queries in a row with nothing new;
  - 20 minutes.

  The 20 minutes is the real bound. `run.service.ts` expires a run 25 minutes after `startedAt`
  (`MAX_RUN_LIFETIME_MS`), and heartbeats don't extend that. The agent heartbeats after each saved
  row only so the run doesn't look stalled before then. Query format and count are the agent's
  choice.
- **Manual research.** Picking "Anywhere on the web" as the board in `/campaigns/new` runs
  `job-researcher` on the typed query instead of `job-searcher` on a board:
  - Search only saves scored `pending` rows for the user to review.
  - Auto-apply researches first, then runs the existing apply loop over the approved rows.
  - A manual campaign is an ordinary one-off campaign with no board and no `feed`, named after its
    query. It closes when idle, like any other.
  - The agent stays the same. Its input gains a nullable `runId` and an `approveAtOrAbove`
    threshold, so it runs without a pilot run and can approve rows itself.
- **Safety.** The open web is attacker-controlled text. Copy the `job-searcher` ground rules (pages
  are data, call only the listed API paths) plus `_shared/untrusted-content.md`. The agent never
  applies, contacts anyone or signs up for anything. It never logs in either, because a portal
  that needs a login is out of scope for research.

## Milestone 1: standing campaigns (job alerts, search)

- Schema, `apps/api/prisma/schema/campaign.prisma`:
  - `enum CampaignFeed { job_alerts research }` with `@@map("campaign_feed")`.
  - `feed CampaignFeed?` on `Campaign`, plus a one-line comment that the open-campaign uniqueness
    lives in hand-written partial indexes.
- Migration (db-migrate skill, hand-edited SQL). The data steps run before the indexes:
  1. Search: for each `pilot_search_id` with more than one open campaign, keep the newest and set
     `pilot_search_id = NULL` on the rest. They drain and finalize as ordinary campaigns, so no
     approved job is stranded.
  2. Job alerts: per user, the newest open campaign with `created_by = 'pilot'` and
     `query LIKE 'Job alerts · %'` gets `feed = 'job_alerts'` and `query = 'Job alerts'`. Older
     open ones stay feedless and drain. Completed history is left alone.
  3. `CREATE UNIQUE INDEX campaigns_open_feed_key ON campaigns (user_id, feed) WHERE feed IS NOT NULL
     AND status IN ('in_progress', 'paused')`.
  4. `CREATE UNIQUE INDEX campaigns_open_search_key ON campaigns (pilot_search_id) WHERE
     pilot_search_id IS NOT NULL AND status IN ('in_progress', 'paused')`.
- Contracts, `packages/contracts/src/campaign.ts`:
  - `CAMPAIGN_FEEDS` and `campaignFeedSchema`.
  - `feed` on `createCampaignSchema`, refined so it's only valid with `createdBy: "pilot"` and
    `source: "auto_apply"`, and never together with `pilotSearchId`.
  - `feed` on the campaign response schema (`campaign.schema.ts` in the API), if the web shows it.
  - Add `CampaignFeed` to `apps/api/src/common/enum-parity.test.ts`.
- `campaign.service.ts` `create`: when `feed` or `pilotSearchId` is set, return the open campaign
  for that key if it exists. Refresh `config.resumeId` if it differs. Otherwise create, and on
  `P2002` from the partial index (a race), re-read and return the winner.
- `maintenance.ts` `finalizeIdleCampaigns(prisma, journal, userId, now, liveFeeds)`:
  - It excludes campaigns with `pilotSearchId` set, and campaigns whose `feed` is in `liveFeeds`.
  - `task-list.service.ts` passes `liveFeeds`: `job_alerts` when alerts are enabled, and
    `research` when goals aren't empty.
- Paused feeds:
  - `gather-searches.ts`: the campaign lookup includes `paused`, and a search with a paused campaign
    isn't due.
  - `jobAlertsDue`: false while the alerts campaign is paused.
  - `JobAlertsService.runNow` resumes it, journaling the resume as a `user` action.
- Plugin:
  - `inbox.jobAlerts.md`: create with `"query":"Job alerts","feed":"job_alerts"`, which returns the
    open one. Add the batched similar-posting check after `seen` (decision above).
  - `search.discover.md`: say the POST returns the search's open campaign, and drop the
    "never open a second campaign" sentence.
- Tests:
  - get-or-create: existing returned, `resumeId` refreshed, `minScore` kept, `P2002` race.
  - finalize: search, live-feed and dead-feed campaigns.
  - paused search not due; paused alerts not due; `runNow` resumes.
- The similar-posting endpoint lands here too, since job alerts uses it first:
  - New `pilot/similar-jobs.controller.ts` and `pilot/similar-jobs.service.ts` under
    `RATE_LIMITS.pilotMutation`, with schemas in contracts.
  - Bounded candidate scan, newest first, at most 2000 rows, like `duplicate.ts`.
  - Drop `appliedAt` from `FuzzyMatchCandidate`, since the match never reads it, so campaign jobs
    fit.
  - Tests: a mirror match, the same title at a different company, and outside the window.

## Milestone 2: research schema, migration, contracts

- `apps/api/prisma/schema/campaign-job.prisma`:
  - `enum CapExemptBasis {...}` with `@@map("cap_exempt_basis")`.
  - On `CampaignJob`: `capExemptBasis CapExemptBasis? @map("cap_exempt_basis")` and
    `capExemptEvidenceUrl String? @map("cap_exempt_evidence_url")`.
- `profile.prisma` `Profile`, next to `requiresSponsorship`:
  `preferCapExempt Boolean @default(false) @map("prefer_cap_exempt")`.
- `pilot.prisma` `PilotState`:
  `researchRequestedAt DateTime? @map("research_requested_at") @db.Timestamptz(3)`.
- Migration via the db-migrate skill: nullable and defaulted columns only, no backfill. Hold the
  apply.
- Contracts:
  - `CAP_EXEMPT_BASES` and `capExemptBasisSchema` in `packages/contracts/src/campaign.ts`.
  - `capExemptBasis` and `capExemptEvidenceUrl` (z.url) on `addCampaignJobSchema`, both optional
    and nullable. Also on `campaignJobSchema`, which the API's `job.schema.ts` reuses, so there's
    no separate API response schema to edit.
  - `preferCapExempt` on `userUpdateSchema` in `packages/contracts/src/user.ts`.
  - `withinDays` on the job-alerts seen body schema.
- API pass-through:
  - `campaign/jobs/job.service.ts` `addJob` writes the two job fields.
  - Add `preferCapExempt` to `PROFILE_SELECT` in `user/user.mapper.ts`. `user.service.ts` already
    spreads profile fields into `prisma.profile.update`, so it needs no edit.
- Add `CapExemptBasis` to `apps/api/src/common/enum-parity.test.ts`.

## Milestone 3: the pilot task in the API

- `packages/contracts/src/pilot/tasks.ts`: a `research.explore` variant with subject `pilot` and
  payload `{goals, resumeId: z.uuid(), minScore, preferCapExempt, requiresSponsorship,
  boards: string[], newJobsTarget, trigger: "requested"|"initial"|"dry"|"periodic"}`.
- `task-defs.ts`: priority 450, `subjectType: "pilot"`, `subjectId: () => "research"`,
  `title: p => "Research jobs beyond your boards"`.
- New `pilot/tasks/gather-research.ts`:
  - `gatherResearch(prisma, userId, ctx, now)` uses `latestRun(…, "research.explore")` with
    `ranRecently` and the trigger rules above.
  - It reads the user's `pilotSearch` rows (`emptyRuns`) for `dry`, and whether the research
    campaign is paused.
  - It reads `requiresSponsorship` and `preferCapExempt` from `prisma.profile.findUnique`. The task
    list doesn't read the profile today.
  - A pure `researchTrigger(...)` helper takes the search count, the backing-off count, the last
    run, `requestedAt` and `now`. It's tested.
- `task-list.service.ts` `gather()`: call it when goals aren't empty. Add `research` to
  `TaskListInput`.
- `build.ts`:
  - Push the task in the `isPipelineQuiet` block, or ungated when `trigger === "requested"`.
  - Add the cap-exempt +10 in `applyTask`. `gather-jobs.ts` selects `capExemptBasis`, and `TaskJob`
    carries it.
- Run now:
  - `POST /api/pilot/research/run` sets `researchRequestedAt`, resumes a paused research campaign,
    resets the snapshot (`TASK_LIST_SNAPSHOT_RESET`), then wakes the pilot. Mirror
    `job-alerts.controller.ts` and `JobAlertsService.runNow`, under `RATE_LIMITS.pilotMutation`.
  - `GET /api/pilot/research` returns `{lastRun: {startedAt, outcome, summary} | null,
    campaignId: uuid | null, requestedAt}` for the web. `campaignId` is the standing research
    campaign.
- `pilot.service.ts` `retire()`: with `rederiveSearches`, also delete `research.explore` runs.
- `job-alerts.service.ts` `seenUrls(userId, urls, withinDays)`: the window becomes a parameter.
- Tests:
  - `builders.ts` `base()` gets `research: null` and a `research` payload builder.
  - `fakes.ts` routes `latestRuns["research.explore"]`.
  - New `tasks.research.test.ts`: one test per trigger, the damper, `dry` at exactly half (no) and
    over half (yes), zero searches (no), and paused (no).
  - `build.test.ts`: gating (quiet-only, requested ungated) and the cap-exempt boost.

## Milestone 4: plugin

- New `plugin/agents/job-researcher.md`:
  - tools: `Bash, Read, Skill, WebSearch, WebFetch, mcp__plugin_jobpilot_playwright__*`
  - `model: inherit`
- What it does with the payload:
  - Chooses its own queries, in any format and as many as discovery needs. It adapts as it goes:
    rewording, narrowing, or following a lead such as a department page or a lab's openings list.
    The doc lists example angles only as starting ideas, never as a fixed set:
    - search operators (`site:edu "research assistant" machine learning`)
    - ATS hosts (`site:myworkdayjobs.com`)
    - lab and department pages
    - aggregators not in `boards`

    The stop conditions bound the run, not a query count.
  - Per hit, it resolves the employer's own posting URL first (dedupe step 1). It reads the
    posting with `WebFetch` first, and with the browser in its own tab when the page is
    JS-rendered (Workday is).
  - Then, per posting:
    1. seen (`withinDays: 30`)
    2. similar (judged per the rule above)
    3. applied check
    4. brief
    5. score-fit
    6. save, or skip

    This is `job-searcher` step 3 plus the similar check, with eligibility skip reasons per
    `_shared/eligibility.md`.
  - Sets `capExemptBasis` and `capExemptEvidenceUrl` only with evidence.
  - Heartbeats after each saved row, and stops by the stop conditions above.
- It returns JSON `{newJobs, jobsSeen, queries:[...], best:[...], capExempt:<count>,
  duplicates:<count>, boardsSuggested:[{domain, why}], skipped:[...], error}`.
- Codex: regenerate `.codex/agents/job-researcher.toml` through the host's `PrepareWorkspace`
  (`apps/terminal/Providers/CodexProvider.cs`), so `CheckedInCodexAgents_MatchThePluginAgents`
  (`tests/JobPilot.Terminal.Tests/Providers/CodexProviderTests.cs`) passes. Codex frontmatter has
  no tools, so the body says "web search when available, else search through the browser".
- `plugin/skills/pilot/tasks/research.explore.md`:
  1. `POST /api/campaigns` with `{"query":"Research","source":"auto_apply","createdBy":"pilot",
     "feed":"research","config":{resumeId, minScore}}`, which returns the open one.
  2. Delegate one `job-researcher` run (or follow the agent doc inline).
  3. Report `done` or `failed`, with `detail {campaignId, queries, boardsSuggested}`.
- Summary example: "Researched 'ML research assistant, US universities': 9 new jobs (5 cap-exempt,
  3 duplicates skipped), best UMich 84. Boards worth adding: higheredjobs.com."
- Agent lists: `.claude/rules/plugin.md`, `plugin/README.md`, `docs/development.md`.

## Milestone 5: web

- `components/features/pilot/task-types.ts`:
  `"research.explore": {label: "Research jobs", agent: "job-researcher"}`. Add `job-researcher` to
  `PilotAgent` and `AGENT_LABELS`, and `AGENT_ROLES` in `overview/stage-card.tsx` ("Finds jobs
  beyond your boards").
- Instructions tab: a small `research-section.tsx` after Searches (add it to `NAV_ANCHORS` in
  `instructions-tab.tsx`).
  - It shows the last run (time, summary), a link to the research campaign, and a "Research now"
    button posting to `/api/pilot/research/run`. Copy `searches-list.tsx`'s `QuerySection`
    pattern.
  - Data: `pilotQueries.research()` in `api/queries.ts`, `pilot.research` in `api/query-keys.ts`.
  - In `pilot-live.tsx`, invalidate it on `run.finished`.
- Profile: a `field.Switch` "Prefer H-1B cap-exempt employers" in
  `settings/sections/work-auth-section.tsx`, plus `toFormValues` in `settings-content.tsx`.
- Campaign job rows: a "Cap-exempt" chip, tooltip showing the basis, linking to the evidence, in
  `campaigns/detail/jobs-table.tsx` where the title or status renders.
- `app/docs/pilot/page.mdx`:
  - A "Research" subsection under "Your instructions": what it searches, when it runs, cap-exempt
    tagging, and that it never logs in or applies.
  - A row in the autonomy table.
  - A line that each search, job alerts and research keep one campaign, and that pausing it pauses
    that feed.

## Milestone 6: manual research campaigns

- Agent input, in `plugin/agents/job-researcher.md`:
  - `goals`: the pilot's goals or the manual query.
  - `runId: string | null`: heartbeat only when it's set.
  - `newJobsTarget`: 5-20 for the pilot. A manual run takes the composer's `maxJobs`, or 20 when
    that's empty.
  - `approveAtOrAbove: number | null`:
    - `null` (the pilot, and manual Search only) saves scored rows as `pending`. For the pilot,
      `promoteScoredPendingJobs` decides; for manual runs, the user does.
    - A number (manual Auto-apply) saves rows at or above it as `approved`, and rows below it as
      `skipped` with the same `Below minimum match score (<n> < <min>)` reason the promote path
      writes.
  - `preferCapExempt` and `requiresSponsorship`: the pilot payload carries them, and a manual run
    reads them from `GET /api/user`.
- `plugin/skills/search/SKILL.md`:
  - A new `--anywhere` flag, which replaces `--board`; exactly one of the two is required.
  - Phases 2-5 become one `job-researcher` delegation with `approveAtOrAbove: null`. The agent saves
    its own rows.
  - The Phase 6 hand-off adds the agent's `boardsSuggested` and cap-exempt count.
  - Rule 1 ("exactly one board per campaign") gets the `--anywhere` exception.
- `plugin/skills/auto-apply/SKILL.md`:
  - The same `--anywhere` flag. With it, Phase 1 is one `job-researcher` delegation with
    `approveAtOrAbove: <min-score>` instead of opening a board.
  - Phase 2 then runs 2.3-2.5 over the campaign's `approved` rows, best first, stopping at
    `--max-apps`. That's the `resume-campaign` replay, so reuse its wording rather than restating
    the loop.
  - With `preferCapExempt`, the order adds the same +10 as the pilot's `applyTask`.
  - Phase 0's manual-run create sends no `board` when `--anywhere` is set.
- Web composer, `components/features/campaigns/composer/`:
  - `form-config.ts`:
    - An `ANYWHERE_BOARD` option value. `isBoardSelected` treats it as no board, so
      `buildCreateCampaignRequest` sends no `board`.
    - `buildSkillArg` sends `--anywhere` instead of `--board`.
    - The board check accepts it.
  - `campaign-basics-fields.tsx`:
    - Show "Anywhere on the web" first in the Board select, for Search only and Auto-apply only.
    - Show the select even when no boards are configured, so research works with zero boards.
    - Swap the mode description and the query placeholder ("ML research assistant roles at US
      universities") when it's picked.
  - `campaign-composer.tsx`: skip `adoptBoard` for it.
  - `app/(dashboard)/campaigns/new/page.tsx` subtitle: "Search a job board or the open web, score
    matches, and optionally batch-apply."
- Docs: `app/docs/campaigns-and-skills/` gets a short "Anywhere on the web" section: what it
  searches, that it never logs in, cap-exempt tags and board suggestions. It links to the pilot
  page's Research subsection.
- Agent and Codex: the agent's input change regenerates `.codex/agents/job-researcher.toml`, and the
  drift test covers it.
- Tests: `form-config` unit tests for the request body (no `board`) and the skill arg
  (`--anywhere`, `--min-score`, `--max-apps`).

## Verification

1. `verify` after each milestone: Biome, knip, API and web typechecks, API and contracts tests,
   and the terminal tests in milestone 4 (Codex drift test).
2. Migrations: review the SQL, get user confirmation, then `db:migrate:apply` and `db:generate`.
   For milestone 1, dry-run the data steps on a prod copy first. Check:
   - no `pilot_search_id` or `(user_id, feed)` has more than one open campaign;
   - no approved job lost its campaign.
3. Unit:
   - Each trigger fires once and then holds for its cooldown, and `requested` beats the damper.
   - A goals change with re-derive clears the runs.
   - The cap-exempt job outranks an equal-score job only when `preferCapExempt` is on.
   - Two concurrent get-or-creates return one campaign.
4. End to end (`bun run dev`):
   - Job alerts: two runs land in the one "Job alerts" campaign, which stays open after its jobs
     are applied. Pausing it stops the scheduled runs, and "Run now" resumes it.
   - Search: a search's second discover run reuses its campaign after the first one's jobs are
     applied.
   - Research: set goals to "ML research assistant roles at US universities, F-1 OPT", turn on
     Prefer cap-exempt, and click Research now. Expect a `research.explore` run in the TUI, rows
     streaming into the "Research" campaign with scores, and cap-exempt chips that link to
     evidence. On the next cycle, rows at or above `minScore` turn approved and `job.apply` tasks
     follow, with cap-exempt ones first.
   - Manual Search only: on `/campaigns/new`, pick Search only and "Anywhere on the web", then
     enter "ML research assistant roles at US universities". Expect a no-board campaign that fills
     with scored `pending` rows, and a terminal hand-off that names suggested boards.
   - Manual Auto-apply: the same with Auto-apply, min score 70 and max applications 2. Expect rows
     of 70 or above `approved`, rows below it `skipped` with the score reason, and exactly two
     applications.
   - With no boards configured, the "Anywhere" option still shows and still runs.
5. Rerun research and confirm last run's postings aren't re-added: neither by URL (seen within 30
   days) nor as a mirror on another host (similar).
6. Codex: start a Codex session and confirm `job-researcher` appears in `.codex/agents/` and a
   research run completes, using browser search if web search is unavailable.
