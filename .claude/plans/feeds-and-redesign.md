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

5. (2026-11-06, before Phase 4) Jobs from skills the user types go to one `manual` feed the pilot
   never auto-applies from. Per-run commands (`resume-campaign`, `/auto-apply resume`,
   `retry-failed <campaign-id>`, `--campaign <id>`) are dropped.

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
- **Tests shrink as code goes.** Tests of deleted code are deleted, not ported. A test stays only
  if it guards behavior that could realistically break. Delete tests that restate the
  implementation, re-test what another test covers, assert only that an event was published or
  a mock was called, or check trivia (string caps, default values). One shared fake per module.
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

1. `maintenance/retention.ts` holds one list of rules (name, window in days, sweep), replacing
   `cleanup.ts` and its per-rule where-builders. New rules: stale proposals dismissed (14d),
   decided changes (90d), finished requests (30d), messages (90d), Found jobs → skipped as stale
   (21d), dropped jobs' description and brief blanked (30d), dropped jobs deleted (180d) unless an
   application or proposal points at them, irrelevant emails deleted (30d), empty completed
   campaigns (7d), listings unseen for 120 days (admins' `hidden` status stays theirs).
2. Questions: `expiresAt` is required (14 days unless the caller sets one). The migration gives
   open questions without one two weeks from now.
3. Irrelevant email bodies are **not** blanked at classification: job-alert emails can be
   classified irrelevant and are still imported for a week.
4. No `cycle` journal entries: the host reports every cycle to `POST /api/pilot/cycles
   {sleepSeconds}` (was `/idle-checks`); the `cycle` kind is dropped; Diagnostics groups the
   journal by run.
5. The retention test maps every Prisma model to its rules, `bounded` or `userData`; a new model
   fails typecheck until it's listed.

## Phase 3: Pilot model cleanup (API + web + plugin)

**Schema** (one migration)

- `pilot_runs.title text NOT NULL`, backfilled from the payload with a SQL `CASE` per task type
  (the same strings `TASK_DEFS[*].title` builds). `RunService.start` writes it; the thread and
  `currentRun` read it and never parse stored payloads.
- `pilot_states`: `instructions_goals` → `goals`, `instructions_config` → `config`,
  `instructions_updated_at` → `goals_updated_at`; drop `job_alerts_requested_at` and
  `research_requested_at`. The config stays one jsonb column (every task builder reads rules and
  settings together); the contract splits it into `pilotRulesSchema` and `pilotSettingsSchema`.
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

Ships with Phase 5's skill changes: the route renames and the end of per-run campaigns break
every skill that creates or completes a campaign, so both land together.

**Model**

- `Feed` (`feeds`): id, user_id, kind (`feed_kind`: search, job_alerts, research, links, manual,
  upwork, networking), name, query (search and upwork), board_id, resume_id, reason, config jsonb
  (`minScore` override from `search.tune`), paused_at, paused_by (`actor`), paused_reason,
  last_run_at, last_jobs_scanned, last_new_jobs, empty_runs, next_run_at, created_by, created_at,
  updated_at. One feed per (user, kind) except `search` (partial unique index).
- Whether the pilot applies on its own follows the kind: search, job_alerts, research and links
  auto-promote scored jobs; manual (jobs from skills the user types), upwork (proposals) and
  networking don't. No `autoApply` column, no `CampaignSource`, no `PROMOTABLE_SOURCES`.
- No completion. A feed is active or paused; `finalizeIdleCampaigns`, `completedAt`, the
  `completed`/`failed` statuses and per-run lifecycles go. `campaign.reviewPaused` → `search.review`
  of a search the pilot or agent paused.
- `Job` (`jobs`, was `campaign_jobs`): `feed_id`; unique (feed_id, key).
- `applications.campaign_id`, `networking_messages.campaign_id` → `feed_id`.

**Migration** (dry-run on the copy; check counts before and after)

1. Search feeds: one per `pilot_searches` row, same id; config and pause from its open campaign.
2. Standing feeds: the open `feed` campaign per (user, feed) keeps its id.
3. Everything else by source and board: networking → networking; board upwork → upwork; the rest
   → manual. Missing feeds are created per user.
4. Jobs move to their campaign's feed. Collisions on (feed_id, key) keep the most advanced status;
   applications and proposals re-point to the kept row first.
5. Task types: `campaign.scorePending` + `queue.score` → `feed.score`, `campaign.reviewPaused` →
   `search.review`, `campaign.tune` → `search.tune`; payload keys `campaignId`/`searchId` →
   `feedId` in `pilot_runs` and `pilot_requests`; run subjects `campaign` → `feed`; reset
   `task_list_snapshot`; parse every run after.
6. Drop `campaigns`, `pilot_searches` and their enums.

**API**: `modules/feeds/` replaces `modules/campaign/` and `pilot/search.*`: `GET /api/feeds`,
`POST /api/feeds {kind, …}` (returns the user's existing feed for single kinds),
`PATCH /api/feeds/:id`, `POST /api/feeds/:id/runs`, `GET|POST /api/feeds/:id/jobs`, and
`PATCH /api/jobs/:id`, `POST /api/jobs/:id/{result,retry,rescan}`. Pause and resume are the
`search.pause`/`search.resume` changes; other kinds pause through `PATCH`.

**Web**: `feedQueries`; Pipeline filter and column by feed name; Upwork reads the upwork feed.

**Host**: the one campaign reference.

## Phase 5: Plugin (4,900 lines: 22 skills, 30 pilot task files, 5 agents)

Done: `search` and `auto-apply` delegate to `job-searcher` / `job-researcher` / `job-applier`
through `feed-flow.md` → Searching (auto-apply modes are `approved` and `retry-failed` on the
manual feed); `form-filling.md` had no readers and went; task files all carry a Payload line;
`CID` → `FEED_ID`; `apps/api/src/plugin-links.test.ts` checks every API call and web link.

Check each overlap at the start of the phase by reading the files; delete before rewriting.

Landed with Phase 4: `resume-campaign` deleted, `apply` takes one job, `campaign-flow.md` became
`feed-flow.md`, and every skill writes to its kind's feed. Searches that are deleted are archived
(`feeds.archived_at`) so their jobs keep their history.

1. Delete `resume-campaign`: pausing and resuming is a search change now.
2. `apply` takes one job (URL or pasted page) only. Its no-argument mode, scoring and applying a
   campaign's pasted links, duplicates the Pipeline's Add job links plus `feed.score` and
   `job.apply`.
3. `auto-apply` and `search` stop running their own search, score and apply loops. They write
   jobs to the `manual` feed through the same agents the pilot uses (`job-searcher`,
   `job-scorer`, `job-applier`), so one copy of each procedure exists.
4. `_shared/campaign-flow.md` becomes `_shared/feed-flow.md`, holding only what more than one
   skill reads. Fold single-reader `_shared/*` files into their reader.
5. Pilot task files: one shape (Summary, Steps, Result), no restating `pilot/SKILL.md`.
6. A check that every `jobpilot-api <METHOD> /api/...` call and every `$JOBPILOT_WEB/...` link in
   `plugin/` matches a real API route or web page, run by `verify`. It would have caught the
   stale `/campaigns/<id>` links and guards Phase 4's renames.
7. After editing `plugin/agents`, regenerate `.codex/agents/*.toml` (CodexProvider.AgentToml).

## Phase 6: Code layout and test trim (no behavior change)

Done: `modules/pilot/` regrouped into `thread/`, `questions/`, `runs/` (run and step routes in one
`run.controller.ts`), `feeds/`, `tasks/gather/`; promotion is `modules/promotion/`. Task labels and
agents live in contracts (`pilot/task-types.ts`); `TASK_SUBJECT_TYPES` is read off the schema, so
`TASK_DEFS` no longer repeats subject types. Web: `features/settings/{pilot,diagnostics}`; the
journal row and cache stay in `features/pilot/journal/` (the home uses them). Host: the Phase 2
pass left no overlap (`StuckDetector` reads output, `CycleRunner` runs the ladder); the unread
`consecutiveTimeouts` status field went. Tests: read, not cut. The three fixture files serve
different seams (pure inputs, Prisma fake, change tx) and merging them breaks the file-size
rule; no test duplicates another.

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
- Host `apps/terminal/Pilot/` (2,100 lines, 14 files): `PilotSession` (255) mixes run start,
  cycle reports, steps, usage and interrupts; `CycleRunner` (280) and `StuckDetector` (167) both
  hold stuck-run logic; `PilotStore` (212) and `PilotLoop` (202). Split by concern, merge what
  overlaps, delete what pairing and requests made unused. Read each file at the start of the phase.
- Test trim, by the rule under Execution. API tests are 8,500 lines in 84 files: pilot 3,017
  plus 645 of fakes (`tasks/fakes.ts`, `tasks/builders.ts`, `changes/fakes.ts`), feeds/jobs
  about 900 plus 165. Merge the fakes into one per module. Terminal tests are 3,200 lines
  (`CycleRunnerTests.cs` 320, `TerminalSessionTests.cs` 227); same rule. Report lines removed
  per module in the commit body.

## Phase 7: Shell and sidebar

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

## Phase 8: Pilot home

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

## Phase 9: Pipeline

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

## Phase 10: Goals & rules and Settings

- **Goals & rules** (`/pilot/goals`): goals; searches (name, applied/week, pause/resume/delete,
  query and reason on expand); rules (cap, min score, deal-breakers, prefer cap-exempt); standing
  answers (start date included). Every edit is a change with Undo.
- **Settings tabs**: Profile, Email, Notifications, Credentials, Security, Pilot, Diagnostics.
  - Job boards moves into Settings → Pilot as one list: drag to order, each row with its login
    status and Add/Edit login (the board credentials).
  - Credentials keeps the default login and the captcha key.
  - Profile loses work-preference fields that are rules.

## Phase 11: Docs and wording

- Docs (`app/(public)/docs/**`): feeds, Goals & rules, the sidebar, Settings → Pilot.
- `git grep -i campaign` over web, plugin and docs comes back empty outside migrations and
  CHANGELOG.
- CHANGELOG `## Unreleased`. No release.

## Out of scope

- A server-side model, headless runs, per-agent models.
- Restructuring Upwork beyond reading its feed.
