# Feeds, retention and pilot redesign plan

## Context

On 2026-11-06 the user reviewed the pilot assistant build (Pilot home, Settings, Pipeline
screenshots) and asked for a full simplification: bugs, data that piles up, the pilot data model,
code layout, and a UI redesign. Findings, measured on the local dev DB (`localhost:5432`, a
production copy with 527 users, newest rows from 2026-11-05):

- **The thread is broken.** 4,175 of 16,140 `pilot_runs` rows fail `taskFieldsSchema`, and
  `taskTitle` parses every run the thread shows. Breakdown: `job.apply` with the brief stored as
  JSON text (3,806), `board.diagnose` with the old `jobBoardId` key (367), `search.discover` with
  a malformed `resumeId` (2).
- **Pipeline bugs.** Upwork recommendations sit in Found forever. The **From** column and filter
  show raw campaign queries and list every old campaign. Needs you is 0 on the Pilot home but 2
  on the Pipeline, because `needs_user` jobs without an open question don't count.
- **Two min scores.** Settings → Profile's auto-apply section (`AutoApplySettings`) and the
  pilot's Rules both set one; `scoring.service.ts` uses the profile value when no rule score is
  passed.
- **Dead code.** `POST`/`PATCH`/`DELETE /api/pilot/searches` have no callers, and
  `changes/search-actions.ts` repeats their logic. `jobAlertsRequestedAt`/`researchRequestedAt`
  predate requests.
- **Growth with no bound.**

  | Table | Local data | Rule today |
  |---|---|---|
  | `campaign_jobs` | 39.4k; 22.2k skipped (21 MB text); 10.1k Found, 1.5k older than 60d | none |
  | `campaigns` | 4,643, up to 855 per user; 2,062 empty completed `auto_apply` | none |
  | `pilot_journal_entries` | 30.2k; 11.8k `cycle` rows holding only `{status, sleepSeconds}` | 30d / digests 90d |
  | `pilot_questions` | 211 open, 208 with no expiry, oldest July | terminal rows 30d |
  | `pilot_changes`, `pilot_requests`, `pilot_messages` | new | none |
  | `email_messages` | 22.9k, 92 MB; 17.3k irrelevant hold 59 MB of bodies | bodies blanked at 60d |
  | `job_listings` | 22k, all `published` since July | none |

- **Code sprawl.** `modules/pilot/` is 7,000 lines with 25 root files. Task metadata lives in
  four places (contracts payload schema, API `task-defs.ts`, web `task-types.ts`, plugin task
  `.md`). Web `features/pilot/` holds settings and diagnostics code that isn't the pilot page.
- **UI.** Duplicate controls (status line Resume vs Get started Turn on), a Get started card that
  takes the top of the thread, an empty thread with the composer far below, search names that
  are raw queries, "paused" in a number column, pilot settings spread over five places, an
  icon-only rail, nav group names ("CORE", "ACCOUNT") as page eyebrows.

## Decisions (user, 2026-11-06)

1. Do every recommendation, including a full UI redesign.
2. **Feed** replaces `PilotSearch` + `Campaign`. A search is a feed with kind `search`.
   `CampaignJob` becomes `Job`. Routes `/api/feeds`, `/api/jobs`.
3. **Expandable sidebar**: 220px with labels and the agent status, collapses to an icon rail, the
   choice remembered.
4. One branch (`feat/pilot-assistant`), no PRs, `verify` + `commit` per phase. **No release
   skill**: the user releases.

Choices made in this plan (veto before the phase that needs them):

- Feed kinds: `search`, `job_alerts`, `research`, `links`, `manual`, `upwork`, `networking`. One
  feed per user for every kind except `search`. `manual` holds jobs from skills the user types in
  the terminal (`/auto-apply`, `/apply`, `/search`). `upwork` holds Upwork recommendations and
  stays out of the Pipeline.
- Whether a feed's scored jobs auto-promote to approved becomes a feed column (`autoApply`),
  replacing `CampaignSource` and `PROMOTABLE_SOURCES`.
- Retention windows: Found jobs older than 21 days become skipped (`stale`); skipped and failed
  jobs lose description and brief after 30 days and are deleted after 180 days unless an
  application or proposal points at them; proposed changes are dismissed after 14 days; decided
  changes are deleted after 90 days; finished requests after 30 days; messages after 90 days;
  questions expire after 14 days; irrelevant emails lose their body once classified and are
  deleted after 30 days (sync reads 14 days back); public listings unseen for 60 days are hidden
  and hidden ones deleted after 180 days.
- Task types: `campaign.scorePending` and `queue.score` merge into `feed.score`;
  `campaign.reviewPaused` → `search.review`; `campaign.tune` → `search.tune`.
- Analytics stays a page.

## Execution

- Branch `feat/pilot-assistant`. Each phase leaves the app working; `verify` then `commit` (no
  co-author trailer). Use `add-api-route` for new routes, `db-migrate` for schema changes,
  `restart-terminal` + `dotnet test` after C# changes.
- Migrations are hand-written. Dry-run them on the production copy before committing (the local
  dev DB on 5432 is one; a restored dump on 5434 if the user provides it). A migration that
  changes a task payload shape resets `pilot_states.task_list_snapshot` and rewrites
  `pilot_runs.payload`; after migrating, parse every `pilot_runs` row with `taskFieldsSchema`.
- Click through each UI phase in a real browser (`run` skill).
- Follow `CLAUDE.md`, `.claude/rules/*.md`, and the memories on vocabulary, null over undefined,
  named param types, simple conditions, file size, terse comments, no redirects.
- New vocabulary from Phase 4: **feed** (kind, `autoApply`), **job**. "Campaign" leaves code,
  routes, plugin and UI; only applied migrations and CHANGELOG keep it.

---

## Phase 1: Release blockers

1. Migration `run_payload_shapes`: parse `job.apply` briefs stored as text, rename
   `board.diagnose` `jobBoardId` → `boardId`, drop malformed `search.discover` `resumeId`; a
   `DO` block raises if any string brief remains. Reset `task_list_snapshot`.
2. Pipeline leaves out Upwork-board jobs (`pipeline.service.ts` `JOB_CAMPAIGNS`), in lists and
   counts.
3. Needs you counts `needs_user` jobs: `useNeedsYou` adds them (title · company, opening the
   Pipeline job drawer), and the nav badge follows.
4. Delete `POST`/`PATCH`/`DELETE /api/pilot/searches`, `PilotSearchService.create/update/remove`
   and its `assertUnique`, their schemas and tests. `search-actions.ts` is the one path.

**Done when**: the thread loads for the user with the most history; the Pipeline has no Upwork
rows; Needs you matches the Pipeline's Needs you count.

## Phase 2: Retention so nothing piles up (API + host)

1. Rules in `maintenance/retention.ts` + `cleanup.ts` for every window listed under Choices:
   changes (dismiss stale proposals, delete decided), requests, messages, jobs (stale Found →
   skipped with `SERVER_SKIP_REASONS.stale`, blank text, delete), irrelevant emails (delete),
   listings (hide, delete).
2. Questions: `expiresAt` is required at create (14 days unless the caller sets one). Migration
   sets `expires_at = now() + 14 days` on open questions without one, then `NOT NULL`.
3. Irrelevant email bodies: blank `body` and `links` when a message is classified irrelevant.
4. No `cycle` journal entries:
   - `POST /api/pilot/idle-checks` becomes `POST /api/pilot/cycles {sleepSeconds, status}`;
     every cycle reports there. It updates `lastCycleAt`, `nextWakeAt`, `cycleCount`.
   - Host: `PilotApi` posts cycles there and stops posting `cycle` journal entries.
   - Drop the `cycle` journal kind (migration deletes the rows, recreates the enum).
   - Diagnostics' cycle timeline groups by run instead.
5. Coverage test: every Prisma model is listed as swept, bounded per user, or kept on purpose;
   a new model fails the test until it's classified.

**Done when**: every table that grows with use has a rule or a stated reason; `dotnet test`
passes.

## Phase 3: Pilot model cleanup (API + web + plugin)

**Schema** (one migration)

- `pilot_runs.title text NOT NULL`, backfilled from the payload with a SQL `CASE` per task type
  (the same strings `TASK_DEFS[*].title` builds). `RunService.start` writes it; the thread and
  `currentRun` read it and never parse stored payloads.
- `pilot_states`: `instructions_goals` → `goals`; `instructions_config` splits into `rules`
  jsonb (`dailyApplyCap`, `minScore`, `dealBreakers`, `preferCapExempt`) and `settings` jsonb
  (`boards`, `checkIntervalMinutes`, `networking`, `promotion`, `jobAlerts`);
  `instructions_updated_at` → `goals_updated_at`; drop `job_alerts_requested_at` and
  `research_requested_at`.
- Drop `auto_apply_settings`: `default_start_date` becomes a `profile_answers` row
  (`startDate`); `min_match_score` and `max_applications_per_campaign` go (rules own the score;
  the daily cap replaces the per-run cap).
- Drop `profiles.prefer_cap_exempt` after copying it into `rules.preferCapExempt`.

**API + contracts**

- `pilotInstructionsConfigSchema` splits into `pilotRulesSchema` and `pilotSettingsSchema`;
  `rules.set` covers `preferCapExempt`. `scoring.service.ts` uses `rules.minScore`.
- `inbox.jobAlerts` and `research.explore` become requestable; delete `POST /job-alerts/runs`,
  `POST /research/runs` and the `requested` gather paths.

**Web**: delete Settings → Profile's auto-apply section; "Prefer cap-exempt" moves to Rules;
Run now buttons create requests.

**Plugin**: skills read `minScore` and the start date from `GET /api/pilot` and saved answers,
not the profile's `autoApply`.

## Phase 4: Feeds replace searches and campaigns (API + web + plugin + host)

**Schema** (one migration, dry-run twice)

- `feeds`: id, user_id, kind (`feed_kind` enum), name, query (null for non-search kinds),
  board_id, resume_id, reason, auto_apply, config jsonb, paused_at, paused_by (`actor`),
  paused_reason, last_run_at, last_jobs_scanned, last_new_jobs, empty_runs, next_run_at,
  created_by, created_at, updated_at. Partial unique index: one feed per (user_id, kind) where
  kind <> 'search'; unique (user_id, query, board_id) for searches.
- `campaign_jobs` → `jobs`, `campaign_id` → `feed_id`; unique (feed_id, key).
- `applications.campaign_id`, `networking_messages.campaign_id` → `feed_id` (null allowed).
- Data:
  - Each `pilot_searches` row becomes a `search` feed (same id); its standing campaign's status
    becomes `paused_*`.
  - Standing feed campaigns become their feed (`job_alerts`, `research`, `links`,
    `networking`).
  - Other campaigns map by source: `search` on the Upwork board → `upwork`; `networking` →
    `networking`; everything else → `manual`.
  - Jobs that collide on (feed_id, key) keep the most advanced status; applications and
    proposals move to the kept row.
  - Drop `campaigns`, `pilot_searches`, `campaign_source`, `campaign_status`, `campaign_feed`.
- Rename task types in `pilot_runs.task_type` and `pilot_requests.task_type`; rewrite payload
  keys (`campaignId` → `feedId`, `searchId` → `feedId`); reset `task_list_snapshot`; parse every
  run afterwards.

**API**

- `modules/feeds/` (feed controller/service, `jobs/`), replacing `modules/campaign/` and the
  pilot search service. Routes: `GET/POST /api/feeds`, `PATCH /api/feeds/:id`,
  `POST /api/feeds/:id/runs`, `GET/POST /api/feeds/:id/jobs`, `PATCH /api/jobs/:id`, plus the
  job result and lookup routes under `/api/jobs`. Creating a non-search feed returns the user's
  existing one.
- Change actions `search.*` keep their names and operate on search feeds.
- `pipeline.service.ts` filters by feed and drops the shadowed-job dedupe if the merge removed
  every repeat.

**Plugin**: every `/api/campaigns` call, `--campaign` flag and `campaignId` field; task files
renamed (`feed.score.md`, `search.review.md`, `search.tune.md`); skills write to their
kind's feed (`POST /api/feeds {kind}` returns the existing one). `plugin/bin/api.mjs` helpers.

**Web**: `campaignQueries` → `feedQueries`; Pipeline **From** → **Feed** with feed names; Upwork
reads its `upwork` feed; Networking reads its `networking` feed.

**Host**: the one campaign reference in `apps/terminal`.

**Memory**: update the vocabulary memory (campaign → feed, CampaignJob → job).

## Phase 5: Code layout (no behavior change)

- `modules/pilot/` regroups: `state/` (pilot controller/service/stats), `thread/` (thread,
  journal), `tasks/` (task list, build, defs, maintenance, digest, `gather/`), `runs/` (run
  service, steps), `questions/` (questions, saved answers), `changes/`, `requests/`,
  `messages/`, `notices/`, `feeds/` → job alerts and research services. Promotion becomes
  `modules/promotion/`.
- Contracts: one task registry (`defineTask`) holding payload schema, subject type, subject id,
  title and label. The API adds priority and `perList`; the web's `task-types.ts` goes. The
  agent per task stays in the registry for Diagnostics.
- Web: `features/pilot/{settings,job-alerts}` → `features/settings/pilot/`;
  `features/pilot/{diagnostics,journal}` → `features/settings/diagnostics/`. `features/pilot/`
  keeps the home: `home/`, `thread/`, `attention/`, `changes/`, `steps/`.

## Phase 6: Shell and sidebar

```
┌──────────────────────┬─────────────────────────────────────────────────────────┐
│ J  JobPilot       «  │  Pipeline                                               │
│                      │  Every job the pilot found, scored, applied to or set   │
│ ◉ Pilot           3  │  aside.                                                 │
│ ▤ Pipeline           │                                                         │
│ ✉ Inbox              │                                                         │
│ ↗ Analytics          │                                                         │
│ ◫ Documents          │                                                         │
│                      │                                                         │
│ CHANNELS             │                                                         │
│ ⇄ Upwork             │                                                         │
│ ☍ Networking         │                                                         │
│                      │                                                         │
│ ──────────────────── │                                                         │
│ ● Agent · idle       │                                                         │
│ ⚙ Settings           │                                                         │
│ (SI) Sukhrob      ⋯  │                                                         │
└──────────────────────┴─────────────────────────────────────────────────────────┘
```

- `Sidebar` replaces `Rail`: 220px expanded, 56px collapsed (`«`/`»`), kept in localStorage.
  Collapsed shows icons with tooltips and the badge as a dot.
- Footer: an **Agent** row (orb, status word; opens the drawer), Settings, the account row. Its
  menu holds Feedback (bug, feature) and Admin.
- Channels show only when used: Upwork when an Upwork board or feed exists, Networking when a
  networking channel is on or messages exist.
- Page headers drop the eyebrow (nav group names). Mobile bottom nav keeps its four tabs.

## Phase 7: Pilot home

```
 ● Idle · next check 10:22 · 3/30 applied today                    [Watch] [Pause]
──────────────────────────────────────────────────────────────┬─────────────────────────
 2 steps left: Start the agent · Turn on autopilot   [Finish]  │ NEEDS YOU · 3
                                                               │ › Salary for Waymo
 ─── Yesterday ───                                             │ › Approve a LinkedIn post
 9:10–9:52 · Applied to 3 · scored 24                          │ › Data Scientist, Brex
   ✓ ML Engineer, New Grad · Duolingo · 82                     │
   ✓ Research Assistant · CMU Robotics · 77                    │ HEADS UP
                                                               │ 14 unread emails [Review]
 ─── Today ───                                                 │
            You: stop applying to jobs that need clearance     │ SEARCHES     applied/week
 Pilot: Done. Added a rule.                                    │ ML engineer, new grad   5
   + Rule  Skip jobs that need clearance            [Undo]     │ Junior AI   ⏸  [Resume]
                                                               │
 ╭──────────────────────────────────────────────────────╮      │ RULES             [Edit]
 │ Ask or tell your pilot…                         [↑] │      │ 30 a day · score 60+
 ╰──────────────────────────────────────────────────────╯      │ Skip: clearance
```

- Status line: one main action by state (offline → **Start agent**; autopilot off → **Turn on
  autopilot**; on → **Pause**), plus Watch, Tell this task, Interrupt while a run is active.
- Get started becomes one line listing the steps left; **Finish** opens a dialog with the
  checklist. The agent and autopilot steps have no buttons of their own; the status line owns
  them.
- Thread: day separators; an empty thread shows a greeting and three suggested prompts as chips
  that fill the composer.
- Right column: Needs you (questions, drafts, proposed changes, `needs_user` jobs), Heads up,
  Searches (name, applied this week; paused shows a pause icon with the reason as a tooltip and
  **Resume**), Rules. Section actions align right.
- `search.tune` names searches whose name still equals their query.

## Phase 8: Pipeline

```
 Pipeline                                                         [+ Add job links]
 Found 140 · To apply 0 · Applied 303 · Needs you 2 · Skipped 1027 · Failed 22
 [Search role, company, URL      ]  [Feed: All ▾]  [Board: All ▾]
 ┌───┬──────────────────────────────┬──────────────┬─────────┬──────────────────┬───────┐
 │ ☐ │ Job                          │ Company      │ Score   │ Feed             │ Found │
 │ ☐ │ Senior CV Engineer           │ Acme         │ 88      │ ML eng, new grad │ 2d    │
 │ ☐ │ Data Analyst                 │ Linder       │ Scoring…│ Junior AI        │ 4h    │
 └───┴──────────────────────────────┴──────────────┴─────────┴──────────────────┴───────┘
  2 selected   [Approve]  [Skip]
```

- Found sorts by score (unscored last, "Scoring…"); single-status tabs drop the Status column.
- Feed filter lists feeds by name; the Feed column shows the name.
- Row selection with bulk Approve and Skip (Found, To apply), Retry (Failed).

## Phase 9: Goals & rules and Settings

- **Goals & rules** (`/pilot/goals`): goals; searches (name, applied/week, pause/resume/delete,
  query and reason on expand); rules (cap, min score, deal-breakers, prefer cap-exempt); standing
  answers (start date included). Every edit is a change with Undo.
- **Settings tabs**: Profile, Email, Notifications, Credentials, Security, Pilot, Diagnostics.
  - Job boards moves into Settings → Pilot as one list: drag to order, each row with its login
    status and Add/Edit login (the board credentials).
  - Credentials keeps the default login and the captcha key.
  - Profile loses work-preference fields that are rules.

## Phase 10: Docs and wording

- Docs (`app/(public)/docs/**`): feeds, Goals & rules, the sidebar, Settings → Pilot.
- `git grep -i campaign` over web, plugin and docs comes back empty outside migrations and
  CHANGELOG.
- CHANGELOG `## Unreleased`. No release.

## Out of scope

- A server-side model, headless runs, per-agent models.
- Restructuring Upwork beyond reading its feed.
