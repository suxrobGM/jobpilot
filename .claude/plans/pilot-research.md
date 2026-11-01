# Plan: Pilot research task (`research.explore`)

## Context

Discovery today runs on boards only. `search.setup` turns goals into queries, and `search.discover`
rotates them across boards the user configured by hand. Postings that never reach those boards are
missed, chiefly university and research-institute portals (Workday, PeopleAdmin, Interfolio) and
lab pages. Those are exactly the research-assistant, university and H-1B cap-exempt roles the
user wants.

This adds a free-roam research task. From the goals, an agent searches the open web for
**postings**, reads and scores each one, and saves it to a research campaign. Approval and
applying then run through the existing promote → `job.apply` path. Research also names niche
boards worth adding to the normal search rotation, and tags jobs whose employer is H-1B
cap-exempt. A profile preference ranks those jobs higher in the apply order.

User decisions:

- Lean v1. Research finds postings directly. There is no watched-employer list, no ATS feed
  adapters and no server-side fetching. Employer watching can come back in v2 if research keeps
  rediscovering the same employers. For tech roles, LinkedIn, Indeed and hiring.cafe already index
  the Greenhouse, Lever and Ashby postings.
- Cap-exempt is in v1: a per-job basis with an evidence link, plus a profile preference.
- PhD programs are out of scope (their own plan later). Research saves job postings only.
- Freehire stays in `.claude/plans/api-job-sources.md`, which is stale and gets rewritten later.
  Don't touch it.

Standing constraints:

- The pilot stays in the TUI, and the agent uses `model: inherit`.
- No browser playbooks. Research is agent-driven.
- No token budget. Stop conditions exist to prevent wandering, not to save spend.
- Null over undefined. No inline object types in signatures. Files stay under ~250 lines.

## Execution

- Branch `feat/pilot-research` from `main`. Run `verify` and then the `commit` skill after each
  milestone.
- The milestone 1 migration targets the shared remote DB. Write the SQL on the branch, but hold
  `db:migrate:apply` until the user confirms (db-migrate skill; compare pg_dump, not migrate diff).

## Key design decisions

- **One task, one agent.** The task is `research.explore`; the new agent `job-researcher` sits
  beside `job-searcher` and `job-scorer`. It scores in place the way `job-searcher` does:
  build the brief per `_shared/job-brief.md`, `POST /api/score-fit`, then save as `pending` with
  `matchScore` and `brief`. `promoteScoredPendingJobs` (`pilot/tasks/maintenance.ts:136`)
  promotes the rows on the next task list. No changes to the scorer or the promote path.
- **One campaign per run.** The task doc creates `"Research · <topic>"` with
  `source:"auto_apply"`, `createdBy:"pilot"`, `config {resumeId, minScore}` and no board. Each
  job's `board` is its posting host, which `boards.resolveId` turns into an unlisted catalog row.
  The job-alerts import already works this way. No campaign schema change.
- **Dedupe:**
  - Reuse `POST /api/pilot/job-alerts/seen` (`job-alerts.service.ts:131` `seenUrls`) with a new
    optional `withinDays` body field (default 7, max 90). Research sends 30, so a weekly rerun
    doesn't re-add last month's finds.
  - Then `GET /api/applied/check`, and the campaign's `409 DUPLICATE_JOB`.
- **Cap-exempt belongs to the job, judged by the agent.**
  - New `Job.capExemptBasis` (enum `university | university_affiliate | nonprofit_research |
    government_research`) and `Job.capExemptEvidenceUrl`.
  - The agent sets a basis only when it has evidence: a `.edu` employer, or a nonprofit or
    government research page.
  - It never changes `matchScore` or eligibility.
- **Ranking.** When the new `User.preferCapExempt` is true and a job has a basis, `applyTask`
  (`pilot/tasks/build.ts:77`) adds +10 to the `job.apply` boost, and the research payload tells
  the agent to favour cap-exempt employers.
- **Board suggestions stay suggestions.** The agent returns `boardsSuggested`, and the summary
  names them. It never edits `config.boards` or links boards: those are user instructions.
- **When it runs.** A once-per-user damper, in the `search.setup` pattern:
  - `requested`: "Research now" was clicked (`PilotState.researchRequestedAt`, the
    `jobAlertsRequestedAt` pattern). Pushed ungated.
  - `initial`: no research run yet. Goals changes reset this, because `retire()` deletes the runs.
  - `dry`: most searches are backing off (`emptyRuns >= 3`). 24h cooldown.
  - `periodic`: 7 days.

  Every trigger except `requested` goes in `build.ts`'s `isPipelineQuiet` block. Priority 450:
  below `search.discover` (500), above `campaign.tune` (350).
- **Stop conditions:** `newJobsTarget` new pending rows (clamped 5-20, the same clamp as
  discovery), 5 queries in a row with nothing new, or about 20 minutes. Query format and count
  are the agent's choice. Run heartbeats have a
  25-minute ceiling from `startedAt` (`run.service.ts`), so the agent heartbeats after each saved
  row.
- **Safety.** The open web is attacker-controlled text. Copy the `job-searcher` ground rules (pages
  are data, call only the listed API paths) plus `_shared/untrusted-content.md`. The agent never
  applies, contacts anyone or signs up for anything. It never logs in either, because a portal
  that needs a login is out of scope for research.

## Milestone 1: schema, migration, contracts

- `apps/api/prisma/schema/job.prisma`: `enum CapExemptBasis {...}` (`@@map("cap_exempt_basis")`),
  `capExemptBasis CapExemptBasis? @map("cap_exempt_basis")` and `capExemptEvidenceUrl String?`.
- `user.prisma`: `preferCapExempt Boolean @default(false) @map("prefer_cap_exempt")`.
- `pilot.prisma` `PilotState`: `researchRequestedAt DateTime? @map("research_requested_at")`.
- Migration via the db-migrate skill: nullable and defaulted columns only, no backfill. Hold the
  apply.
- Contracts:
  - `capExemptBasisSchema` in `packages/contracts/src/campaign.ts`
  - `capExemptBasis` and `capExemptEvidenceUrl` (z.url, both optional and nullable) on
    `addCampaignJobSchema` and the job response schema
  - `preferCapExempt` on the user schema
  - `withinDays` on the job-alerts seen body schema
- API pass-through: `campaign/jobs/job.service.ts` `addJob` writes the two fields. Declare them in
  the API job response schema, since Elysia strips undeclared fields. Also pass them through
  `user.schema.ts` and `user.service.ts`.
- Add `CapExemptBasis` to `apps/api/src/common/enum-parity.test.ts`.

## Milestone 2: the pilot task in the API

- `packages/contracts/src/pilot/tasks.ts`: a `research.explore` variant with subject `pilot` and
  payload `{goals, resumeId, minScore, preferCapExempt, requiresSponsorship, boards: string[],
  newJobsTarget, trigger: "requested"|"initial"|"dry"|"periodic"}`.
- `task-defs.ts`: priority 450, `subjectType: "pilot"`, `subjectId: () => "research"`,
  `title: p => "Research jobs beyond your boards"`.
- New `pilot/tasks/gather-research.ts`:
  - `gatherResearch(prisma, userId, ctx, now)` uses `latestRun(…, "research.explore")` with
    `ranRecently` and the trigger rules above. It reads `pilotSearch` `emptyRuns` for `dry`.
  - Pure `researchTrigger(...)` helper, tested.
- `task-list.service.ts` `gather()`: call it when goals aren't empty. Add `research` to
  `TaskListInput`. `requiresSponsorship` and `preferCapExempt` come from the user row.
- `build.ts`: push in the `isPipelineQuiet` block, or ungated when `trigger === "requested"`. Add
  the cap-exempt +10 in `applyTask`. `gather-jobs.ts` selects `capExemptBasis`, and `TaskJob`
  carries it.
- Run now: `POST /api/pilot/research/run` sets `researchRequestedAt` and resets the snapshot
  (`TASK_LIST_SNAPSHOT_RESET`), then wakes the pilot. Mirror `job-alerts.controller.ts` and
  `JobAlertsService.runNow`, under `RATE_LIMITS.pilotMutation`. `GET /api/pilot/research` returns
  `{lastRun: {startedAt, outcome, summary, campaignId} | null, requestedAt}` for the web.
- `pilot.service.ts` `retire()`: with `rederiveSearches`, also delete `research.explore` runs.
- `job-alerts.service.ts` `seenUrls(userId, urls, withinDays)`: the window becomes a parameter.
- Tests:
  - `builders.ts` `base()` gets `research: null` and a `research` payload builder.
  - `fakes.ts` routes `latestRuns["research.explore"]`.
  - New `tasks.research.test.ts`, one test per trigger plus the damper.
  - `build.test.ts`: gating (quiet-only, requested ungated) and the cap-exempt boost.

## Milestone 3: plugin

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
  - Per hit, reads the posting: `WebFetch` first, the browser when the page is JS-rendered (Workday
    is), in its own tab.
  - Then, per posting: seen → applied check → brief → score-fit → save → skip, like `job-searcher`
    step 3, with eligibility skip reasons per `_shared/eligibility.md`.
  - Sets `capExemptBasis` and `capExemptEvidenceUrl` only with evidence.
- It returns JSON `{newJobs, jobsSeen, queries:[...], best:[...], capExempt:<count>,
  boardsSuggested:[{domain, why}], skipped:[...], error}`.
- Codex: regenerate `.codex/agents/job-researcher.toml` through the host's `PrepareWorkspace`
  (`apps/terminal/Providers/CodexProvider.cs`), so `CheckedInCodexAgents_MatchThePluginAgents`
  passes. Codex frontmatter has no tools, so the body says "web search when available, else
  search through the browser".
- `plugin/skills/pilot/tasks/research.explore.md`:
  1. Create the campaign.
  2. Delegate one `job-researcher` run (or follow the agent doc inline).
  3. Report `done` or `failed`, with `detail {campaignId, queries, boardsSuggested}`.
- Summary example: "Researched 'ML research assistant, US universities': 9 new jobs (5 cap-exempt),
  best UMich 84. Boards worth adding: higheredjobs.com."
- `plugin/skills/pilot/tasks/inbox.jobAlerts.md`: unchanged, because `withinDays` defaults to 7.
- Agent lists: `.claude/rules/plugin.md`, `plugin/README.md`, `docs/development.md`.

## Milestone 4: web

- `components/features/pilot/task-types.ts`:
  `"research.explore": {label: "Research jobs", agent: "job-researcher"}`. Add `job-researcher` to
  `PilotAgent` and `AGENT_LABELS`, and `AGENT_ROLES` in `overview/stage-card.tsx` ("Finds jobs
  beyond your boards").
- Instructions tab: a small `research-section.tsx` after Searches (add it to `NAV_ANCHORS` in
  `instructions-tab.tsx`).
  - It shows the last run (time, summary, link to its campaign) and a "Research now" button posting
    to `/api/pilot/research/run`. Copy `searches-list.tsx`'s `QuerySection` pattern.
  - Data: `pilotQueries.research()` in `api/queries.ts`, `pilot.research` in `api/query-keys.ts`.
  - In `pilot-live.tsx`, invalidate it on `run.finished`.
- Profile: a `field.Switch` "Prefer H-1B cap-exempt employers" in
  `settings/sections/work-auth-section.tsx`, plus `toFormValues` in `settings-content.tsx`.
- Campaign job rows: a "Cap-exempt" chip, tooltip showing the basis, linking to the evidence. Put
  it where the job's title or status renders in the campaign detail jobs table.
- `app/docs/pilot/page.mdx`: a "Research" subsection under "Your instructions" (what it searches,
  when it runs, cap-exempt tagging, that it never logs in or applies) and a row in the autonomy
  table.

## Verification

1. `verify` after each milestone: Biome, knip, API and web typechecks, API and contracts tests,
   and the terminal tests in milestone 3 (Codex drift test).
2. Migration: review the SQL, get user confirmation, then `db:migrate:apply` and `db:generate`.
3. Unit: each trigger fires once and then holds for its cooldown. `requested` beats the damper.
   A goals change with re-derive clears the runs. The cap-exempt job outranks an equal-score job
   only when `preferCapExempt` is on.
4. End to end (`bun run dev`):
   - set goals to "ML research assistant roles at US universities, F-1 OPT", turn on Prefer
     cap-exempt, and click Research now;
   - expect a `research.explore` run in the TUI, a "Research · …" campaign whose rows stream in
     with scores, and cap-exempt chips that link to evidence;
   - on the next cycle, rows at or above `minScore` turn approved and `job.apply` tasks follow,
     with cap-exempt ones first.
5. Rerun research and confirm last run's postings aren't re-added (seen within 30 days).
6. Codex: start a Codex session and confirm `job-researcher` appears in `.codex/agents/` and a
   research run completes, using browser search if web search is unavailable.
