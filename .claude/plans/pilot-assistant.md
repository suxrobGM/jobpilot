# Pilot assistant redesign plan

## Context

On 2026-11-05 the user reviewed screenshots of Workspace, Pilot (Overview, Instructions, Activity)
and the agent dock. What's wrong:

- **Internals on show.** The Pilot page explains how the system works (Host → Server → Session →
  Journal, six agents with token counts, "2829 cycles", "sleeps 15s") instead of what it did. A
  user wants three answers: is it working, what did it do, what does it need from me.
- **Two homes.** Workspace and Pilot both show pilot status, with different controls ("Pilot Off ·
  Open", "Off · Start", Orchestration's "Host: Off", the dock's "READY").
- **"Campaign" means three things.** Since v2.3.4 each search and feed keeps one standing campaign
  (commit 986d21bc), so the pile-up stopped. Workspace still lists 78 old completed campaigns, and
  the paused "campaigns" are the pilot's searches under another name.
- **Numbers nothing reacts to.** 303 applied, 0 interviewing, and neither page says anything.
  Replies are only classified when the agent reviews the inbox, and the pilot had been off for 25
  days, so the 0 may just be unread mail.
- **Steering is a form.** A goals textarea plus three retire toggles; searches are read-only with
  reasons like "Campaign yield 18%". The goals text holds a standing answer ("set visa
  sponsorship to no") that belongs in saved answers.
- **Sub-features take whole panels.** Job alert emails fills half a screen to say "off, nothing
  waiting".
- **Two ways to run work.** The web types skills into the terminal (`injectSkill`, 24 calls in 18
  files) while the pilot loop drives the same terminal.
- **The terminal is the only live element.** It's a raw TUI in a 380px column beside every page,
  and a phone can't reach it (it connects to `localhost:4102`).

Goal: one home where you talk to the pilot and see what it did, one list of every job it touched,
and one way work runs.

## Decisions (user, 2026-11-05)

1. **Pilot becomes the home page** (`/pilot`): a status line, a thread (activity feed plus
   conversation), a composer, and a right column (Needs you, Heads up, Searches, Rules). Workspace
   and the Pilot tabs are deleted.
2. **Chat runs in the visible terminal session.** A `chat.reply` task at top priority, answered
   by the user's own Claude Code or Codex session. No headless mode, no model on the server, no
   model routing.
3. **One execution path.** Every web button and chat message becomes a request that runs as a
   normal pilot run. `injectSkill` and the host's `/sessions/inject` are deleted.
4. **Autopilot is a server flag.** The host loop runs whenever the agent is paired. Requests,
   chat and answered questions always run. Autonomous work runs only with autopilot on.
   Pause/Resume works from any device.
5. **Typing in the terminal holds new runs**, so an always-on loop never clears the user's own
   session.
6. **Wakes come from the API event stream**, never from the web calling the host. A phone can
   drive everything except the raw terminal.
7. **Changes have Undo; suggestions have Apply.** A change the user asks for applies at once with
   Undo. A change the pilot or a notice suggests is a proposal with Apply/Dismiss. The pilot may
   change its own searches (applied, with Undo) but only proposes changes to the user's goals and
   rules.
8. **Searches are the unit users see.** Each gets a plain `name` the pilot writes. "Campaign"
   leaves the UI and stays the internal job container of a search or feed. No Campaign→Run
   rename, no durable-campaign layer.
9. **Pipeline** (`/pipeline`, since the public `/jobs` is taken) lists every job across searches
   and feeds: Found, To apply, Applied, Needs you, Skipped, Failed. A posting the user already
   has from the last 30 days isn't added again, and the list dedupes older history by normalized
   URL. No postings table.
10. **Notices are deterministic server code**, computed on read. They check that their data is
    current before drawing conclusions.
11. **The terminal opens on demand** in an agent drawer, with a Steps tab (readable,
    phone-friendly) and a Terminal tab (the real TUI). The dock column goes.
12. **Diagnostics** (orchestration, agents, token cost, task list, raw journal) move to Settings →
    Diagnostics.
13. **Routes are deleted outright**, no redirects: `/workspace`, `/workspace/applications`,
    `/pilot/activity`, `/pilot/instructions`, `/campaigns/new`, `/campaigns/[id]`, `/boards`,
    `/portfolio`.

Choices made while writing this plan (veto before the phase that needs them):

- Changes get their own `pilot_changes` table, not a `proposal` question kind. Undo needs a stored
  inverse, applied changes must show in the thread, and accepting one must not wake the agent the
  way `question.answered` does.
- The pilot's chat reply arrives in its run result (`detail.reply`), so the API never needs to
  tell the agent's token from a browser session.
- The library page keeps the name **Documents** and gains a Portfolio tab. "Profile" would clash
  with Settings → Profile.
- Deal-breakers are rules the pilot applies when screening. The job brief is a free-form JSON
  record (`jobBriefSchema` in `packages/contracts/src/campaign.ts`), so the server enforces only
  the cap and the min score.

## Execution

- Branch `feat/pilot-assistant` off `main`, no PRs, one branch for every phase.
- At the start, save a project memory pointing at this plan.
- One or more commits per phase with the `commit` skill. Run the `verify` skill before each
  commit. Use `add-api-route` for new routes, `db-migrate` for schema changes, and
  `restart-terminal` plus `dotnet test` after C# changes.
- Migrations are hand-written. Dry-run them on a restored prod dump on port 5434, never on the
  tunnel. A migration that changes task payload shapes also resets
  `pilot_states.task_list_snapshot`.
- Each phase leaves the app working. Click through it in a real browser before committing (`run`
  skill; if Playwright MCP is down, `playwright-core` with the installed Chrome from the
  scratchpad).
- Follow `CLAUDE.md`, `.claude/rules/web.md` and `.claude/rules/terminal.md`. Pilot vocabulary:
  task list, task, run, `taskType`, hint, job brief, digest. New terms: thread, work block,
  request, message, change, notice, autopilot, pair, hold, steer, interrupt.
- Deploy in two batches; see **Deploy**.

## Target design

### Pilot home (`/pilot`)

```
 ● Applying: ML Engineer, Scale AI · 4m · 3/30 today      [Watch] [Interrupt] [Pause]
────────────────────────────────────────────────────────┬─────────────────────────────
                                                        │ NEEDS YOU · 2
  9:10–9:52 · Applied to 3 jobs · ran 2 searches        │ › Salary for Waymo
    ✓ ML Engineer, New Grad · Duolingo · 82             │ › Email to J. Park, Brex
    ✓ Research Assistant · CMU Robotics · 77            │
    ✓ AI Engineer I · Brex · 71                         │ HEADS UP
    · Scored 24 jobs for ML engineer, new grad          │ 14 emails the pilot hasn't
                                                        │ read yet    [Review inbox]
  ? Waymo asks for a salary expectation.                │
    [ $110k ]  [ $120k ]  [ Type an answer ]            │ SEARCHES     applied/week
    [x] Use this answer on every application            │ ML engineer, new grad    5
                                                        │ Research assistant       1
               You: stop applying to jobs that need     │
               clearance, and add PA university labs    │ RULES               [Edit]
                                                        │ 30 a day · score 60+
  Pilot: Done. Added a rule and a search.               │ Skip: security clearance
    + Rule     Skip jobs that need clearance            │
    + Search   University labs, PA         [Undo]       │
                                                        │
  ╭────────────────────────────────────────────────╮    │
  │ Ask or tell your pilot…               [+]  [↑] │    │
  ╰────────────────────────────────────────────────╯    │
```

- **Status line**: the agent's state, the current run's title and age, applied today against the
  cap, and **Watch**, **Interrupt**, **Pause/Resume**. Idle: "Idle · next check 10:22 · Check
  now". Offline: "Agent offline · Start agent".
- **Thread** (main column, newest at the bottom):
  - **Work blocks.** Runs less than 20 minutes apart fold into one card. The headline counts runs
    by task type. Each line is a run's result summary, linked to its subject. Cycle entries stay
    hidden.
  - **Questions, drafts and approvals**, answered in place with the existing question and
    promotion cards. "Use this answer on every application" saves a profile answer.
  - **Changes**: applied ones with Undo, proposed ones with Apply/Dismiss.
  - **Notes**: the host's reports (stuck runs, restarts, breaks) and other journal lines without a
    run, as muted one-liners. They're rare; idle checks don't write journal entries.
  - **Digest**: the morning summary.
  - **Messages**: the user's and the pilot's.
  - **Get started**: one pinned card until setup is done (resume, profile basics, goals, email,
    agent paired, autopilot on). It replaces the pilot setup checklist and the workspace profile
    checklist.
- **Composer**: free text goes to the pilot. Pasted job links show a chip, "Add 2 links to your
  pipeline", that adds them without a model. While a run is active, **Tell this task** types the
  text into the running session.
- **Right column**: Needs you (open questions, drafts awaiting approval, proposed changes), Heads
  up (notices), Searches (name, applied this week, paused or not), Rules (cap, min score,
  deal-breakers, with Edit).
- **Mobile**: the status line and the thread, with the right column behind a "Needs you" sheet.
  Steps work on a phone; the Terminal tab doesn't, because it connects to `localhost`.

### Other surfaces

- **Pipeline** (`/pipeline`): view tabs with counts (Found, To apply, Applied, Needs you, Skipped,
  Failed), filters (search or feed, board, text), an outcome strip on Applied (applied →
  screening → interviewing → offer), a row drawer (job brief, score and reason, skip or fail
  reason, application timeline, actions), and **Add job links**.
- **Goals & rules** (`/pilot/goals`): goals text, searches (name, query on expand, yield,
  pause/resume/delete), rules (cap, min score, deal-breakers), standing answers. From Phase 4,
  every edit is a change with Undo.
- **Settings → Pilot** (`/settings/pilot`): board order, check interval, networking autonomy, post
  platforms, job alert schedule, research.
- **Settings → Diagnostics** (`/settings/diagnostics`): orchestration panel, agent list, token
  cost, task list, the raw journal with its filters.
- **Settings → Boards** (`/settings/boards`) and **Documents → Portfolio** (`/documents/portfolio`).
- **Agent drawer**: opened from the rail's agent button or the status line's Watch. It holds the
  agent status, provider select, restart and stop, the install, offline and update cards, and the
  Steps and Terminal tabs.
- **Nav**: Core: Pilot, Pipeline, Inbox, Analytics. Channels: Upwork, Networking. Library:
  Documents. Footer: Settings, Admin.

---

## Phase 1: Thread and Pilot home (API + web; no host or plugin change)

**API**

1. `packages/contracts/src/pilot/thread.ts`: `pilotThreadItemSchema`, a union on `type`:
   - `work` {id, startedAt, endedAt, runs: [{runId, taskType, title, summary, outcome,
     subjectType, subjectId, finishedAt}]}
   - `question` {question}, `promotion` {promotion}, `digest` {entry}, `note` {entry}
   - Page shape `{items, nextCursor}` on the shared cursor pagination (`cursorQuerySchema`,
     `cursorPageSchema`, as `pilot/journal.ts` uses).
2. `GET /api/pilot/thread?cursor=&limit=` in a new `apps/api/src/modules/pilot/thread.service.ts`
   with its controller:
   - Read one page of journal entries (kinds action, digest, system, correction), plus the
     questions and promotions created in the same time range, and merge them.
   - Entries with a `runId` fold into their run's work block. The agent's result summary is
     already an `action` entry with `runId` (`tasks/run.service.ts` `postResult`).
   - Drop cycle entries. Every other entry without a run is a `note`.
3. `GET /api/pilot` state: add `currentRun.title`, computed as `TASK_DEFS[taskType].title(payload)`
   (`tasks/task-defs.ts`).

**Web**

1. `app/(dashboard)/pilot/page.tsx` renders `PilotHome`. Delete `pilot/layout.tsx` (the tabs) and
   `pilot/activity/page.tsx`.
2. New `components/features/pilot/home/`:
   - `pilot-home.tsx`, `status-line.tsx`
   - `thread/thread.tsx` (newest at the bottom, loads earlier items on scroll-up),
     `thread/work-card.tsx`, `thread/digest-card.tsx`, `thread/note-row.tsx`,
     `thread/get-started-card.tsx`
   - `side/needs-you.tsx`, `side/searches-summary.tsx`, `side/rules-summary.tsx`
   - Reuse `attention/question-card.tsx` and `attention/promotion-card.tsx`. Work-block headlines
     take their labels from `pilot/task-types.ts`.
3. Add `pilotQueries.thread()` in `api/queries/pilot.ts`. `PilotLive` invalidates it on
   `journal.appended`, `question.*`, `promotion.*` and `run.*`.
4. `/pilot/goals` (Goals & rules), built from the goals section, searches list and limits section
   in `pilot/instructions/`. It keeps today's save path and the goals-change dialog until Phase 4.
5. `/settings/pilot`, built from the boards, networking, platforms and research sections, plus the
   job alerts panel shrunk to a toggle and its schedule (`job-alerts/schedule-dialog.tsx`). Add
   the tab to `components/features/settings/settings-tabs.tsx`. Delete
   `pilot/instructions/page.tsx` and `instructions-tab.tsx`.
6. `/settings/diagnostics`: move `overview/orchestration-panel.tsx`, `stage-card.tsx`,
   `agent-list.tsx`, `task-list-preview.tsx` and `journal/*` (feed, filters, cycle timeline, cycle
   cost, export) there.
7. Delete the rest of `overview/`: `overview-tab.tsx`, `status-bar.tsx`, `today-panel.tsx`,
   `recent-activity.tsx`, and `setup-checklist.tsx` (merged into the Get started card). Also
   delete `job-alerts/job-alerts-panel.tsx`. Run `bun run knip`.

**Tests**: thread merging. A run's entries fold into one block, runs 20+ minutes apart split, and
cycle entries are dropped (`thread.service.test.ts`).

**Done when**: `/pilot` shows the status line, the thread with real history, and the right column.
Goals & rules, Settings → Pilot and Diagnostics hold everything the old tabs did.

## Phase 2: Pipeline replaces Workspace and the campaign pages

**API**

1. New `apps/api/src/modules/pipeline/` with `GET /api/pipeline/jobs?view=&campaignId=&boardId=&q=&page=&pageSize=`
   and `GET /api/pipeline/counts`.
   - Views map to job statuses: found = queued, pending; toApply = approved, applying; applied;
     needsYou = needs_user; skipped; failed.
   - The applied view joins `Application` (status, latest event).
   - Dedupe across campaigns by `CampaignJob.url` (normalized on write in `job.service.ts`),
     keeping the most advanced status.
   - Leave out Upwork and networking campaigns.
2. `POST /api/pipeline/links {urls}` adds the links as `queued` jobs to a standing **links** feed
   campaign. Add `links` to the `CampaignFeed` enum, and create that campaign with source `apply`
   so `queue.score` picks its jobs up (`tasks/gather-campaigns.ts:76` reads `source: "apply"`
   campaigns with queued jobs).
3. The OAuth login redirect in `auth/providers.controller.ts:97` goes to `/pilot`.
4. Don't add a posting twice. Search runs don't call `POST /api/pilot/jobs/existing` the way the
   researcher and the job-alert import do, so two overlapping searches score the same posting
   twice.
   - In the job insert path (`campaign/jobs/job.service.ts`, `POST /api/campaigns/:id/jobs`), skip
     a job when the user already has the same normalized `url` in any campaign from the last 30
     days (the window `jobs/existing` uses).
   - Respond with the existing row and `duplicate: true`. It's the same shape as a created job, so
     older plugins keep working. Don't count it as new for the search.
   - `POST /api/pipeline/links` reports duplicates too, so the dialog can say "2 already in your
     pipeline".
5. A standing **networking** campaign, like the links feed: add `networking` to `CampaignFeed`,
   created with source `networking`. `POST /api/networking/campaign` returns it, creating it on
   first use. Today the campaign composer is the web's only way to create a networking campaign,
   and this phase deletes the composer.

**Web**

1. `app/(dashboard)/pipeline/page.tsx` + `components/features/pipeline/`:
   - View tabs with counts, filters, and a `DataTable` with server pagination
     (`usePaginationParams`).
   - The row drawer, the Applied outcome strip (from `workspace/applications/funnel-bar.tsx`), and
     the Add job links dialog.
   - Approve and skip use the existing job patch route (`campaign/jobs/job.controller.ts:60`).
   - Live updates come from the workspace channel (`campaignjob.*`, `application.created`). Move
     `WorkspaceLive` out of `app/(dashboard)/workspace/layout.tsx`.
2. Delete `/workspace`, `/workspace/applications`, `/campaigns/new`, `/campaigns/[id]`,
   `components/features/workspace/**` and `components/features/campaigns/**`. Keep what the
   Pipeline reuses: `detail/reason-breakdown.tsx` for the Skipped view, and the `jobs-table.tsx`
   columns. Move the Stealth Code banner to the bottom of the Pilot right column.
3. Nav (`layout/shell-config.ts`): remove Workspace, add Pipeline. The landing route becomes
   `/pilot`:
   - `proxy.ts:55`, `hooks/use-auth.ts:29,36`, `onboarding/onboarding-wizard.tsx:90`
   - `auth/verify-email-view.tsx`, `app/robots.ts`
   - `applications/application-detail.tsx` goes back to `/pipeline?view=applied`
4. `GET /api/campaigns/summary`: delete it if nothing reads it any more (check with knip and grep).
5. Networking → Messages takes over the networking board. `NetworkingBoard` renders only on the
   campaign detail page (`campaigns/campaign-detail.tsx:82`), which this phase deletes.
   - Move its selection and Rewrite selected into `NetworkingMessagesList`. Until Phase 5, Rewrite
     selected works only when the selected drafts share one campaign, since the skill takes one
     `--campaign`.
   - Add a **Find contacts** dialog (who to look for, in plain words). It gets the standing
     networking campaign and injects `networking "<criteria>" --campaign <id>`.
   - Phase 5 turns both actions into requests.

**Plugin.** Ship a plugin patch release with batch A so agents stop linking to deleted pages:

- `$JOBPILOT_WEB/campaigns/<id>` → `$JOBPILOT_WEB/pipeline?campaign=<id>` in
  `apply/SKILL.md:111,264`, `auto-apply/SKILL.md:14,68,219` and
  `pilot/tasks/campaign.reviewPaused.md:25`.
- `networking/SKILL.md:144,180` → `$JOBPILOT_WEB/networking/messages`, since the Pipeline leaves
  networking campaigns out.
- `apply/SKILL.md:133` and `auto-apply/SKILL.md:45`: Apply to links now lives in the Pipeline's
  Add job links.

**Tests**:

- A job whose URL the user already has from the last 30 days isn't added again; an older one is.
- Pipeline dedupe: the same URL in two campaigns shows once, and the most advanced status wins.
- The view filters.

**Done when**: nothing links to `/workspace` or `/campaigns`, every job and application is
reachable from `/pipeline`, and outreach starts from Networking → Messages.

## Phase 3: Agent drawer replaces the dock

1. Remove `AgentDock` from `layout/app-shell.tsx:40`. Add `features/agent/agent-drawer.tsx` (MUI
   `Drawer`, right side, resizable, width kept in `lib/terminal/agent-storage.ts`), mounted once
   in `AppShell`.
2. Move these out of `agent-dock/`: the header (status, provider select, restart, stop),
   `agent-install-card`, `agent-offline-card`, `update/*` and `terminal-panel.tsx`. Tabs: Terminal
   now, Steps in Phase 7.
3. Rail: an agent button at the foot (orb plus status dot) opens the drawer. On mobile it's an
   entry in the More sheet. Rename `expanded/expand/collapse` in `providers/agent-provider.tsx` to
   `drawerOpen/openDrawer/closeDrawer`, end to end.
4. Onboarding lands on `/pilot` with the drawer open.
5. Delete `dock-strip.tsx`, `dock-panel.tsx` and `agent-dock.tsx`.

**Done when**: no page loses width to the dock, and the terminal still opens and replays its
buffer.

## Phase 4: Changes with Undo, rules, named searches

**Schema** (one migration)

- `pilot_changes`: id, user_id, source (`user`, `chat`, `pilot`, `notice`), status (`proposed`,
  `applied`, `undone`, `dismissed`), summary, actions jsonb, undo jsonb null, run_id null,
  created_at, decided_at.
- `pilot_searches.name text NOT NULL`, backfilled from `query`.
- `dealBreakers` (a string array, default `[]`) in `pilotInstructionsConfigSchema`. The config is
  JSON, so the column doesn't change.

**Contracts**: `packages/contracts/src/pilot/change.ts` defines `pilotChangeActionSchema`, a union
on `type`. Each action has an inverse:

| Action | Inverse |
|---|---|
| `goals.set {goals}` | `goals.set` with the old text |
| `rules.set {dailyApplyCap?, minScore?, dealBreakers?}` | `rules.set` with the old values |
| `search.create {name, query, resumeId?, reason}` | `search.delete {searchId}` |
| `search.update {searchId, name?, query?, reason?}` | `search.update` with the old values |
| `search.pause {searchId}` / `search.resume {searchId}` | each other (they pause or resume the search's standing campaign) |
| `search.delete {searchId}` | `search.create` with the old fields (job history stays with the old campaign) |
| `answer.set {key, value}` / `answer.delete {key}` | the old answer, or `answer.delete` |
| `jobs.skip {refs, reason}` | `jobs.restore {refs with their previous statuses}` |

**API**

1. `ChangeService` (`apps/api/src/modules/pilot/change.service.ts`):
   - `apply(userId, {summary, actions, source, runId?})` computes the inverse from the current
     state and applies everything in one transaction.
   - Also `propose(...)`, `applyProposed(id)`, `dismiss(id)`, and `undo(id)` for applied changes
     up to 7 days old.
   - Publishes `change.updated` on the pilot channel.
2. Routes: `GET /api/pilot/changes?status=`, `POST /api/pilot/changes {summary, actions,
   propose?}`, and `POST /api/pilot/changes/:id/{apply,dismiss,undo}`.
3. Replace `PUT /api/pilot/instructions`, `GET /instructions/impact` and
   `pilotInstructionsChangeSchema`:
   - Goals and rules go through changes. The goals dialog folds today's three toggles into one
     change: "Rebuild searches" adds `search.delete` for every search, so `search.setup`
     re-derives them; "Drop approved jobs that no longer fit" adds `jobs.skip`. `search.delete`
     already covers the complete-campaigns toggle.
   - Settings get `PATCH /api/pilot/settings {boards?, checkIntervalMinutes?, networking?,
     promotion?, jobAlerts?}`.
4. `POST /api/pilot/searches` defaults `name` to the query. The plugin starts writing names in
   Phase 5.
5. Thread: add a `change` item type.

**Web**:

- The Goals & rules page writes changes, and the rules summary edits inline.
- Change cards in the thread: Undo on applied changes, Apply/Dismiss on proposed ones.
- Needs you includes proposed changes. The nav badge (`layout/nav-badge.tsx:12`) counts
  everything in Needs you, not only questions.
- Searches show their names, with the query on expand.

**Tests**: one table-driven test that applies then undoes each action type and checks that the
state comes back. Proposed changes don't touch state until applied.

## Phase 5: One execution path: autopilot, requests, chat (API + web + host + plugin)

This phase changes the host, so it ships in batch B with a host and plugin release.

**Schema** (one migration)

- Rename `pilot_states.running` to `autopilot`.
- `pilot_messages`: id, user_id, author (`user`, `pilot`), body text, run_id null, created_at.
- `pilot_requests`: id, user_id, task_type, payload jsonb, status (`pending`, `running`, `done`,
  `failed`, `cancelled`), source (`web`, `chat`, `notice`), run_id null, created_at, finished_at.
- Reset `pilot_states.task_list_snapshot`, since task payload shapes change.

**Contracts and task types** (`packages/contracts/src/pilot/tasks.ts`, `tasks/task-defs.ts`)

- New: `chat.reply {messageId}`, `resume.extract {resumeId, force}`, `resume.tailor
  {jobDescription, baseResumeId?}`, `networking.find {criteria}`, `networking.rewrite
  {messageIds}`, `upwork.profile {mode: review | apply}`, `upwork.proposal {proposalId}`,
  `upwork.submit {proposalId}`.
- Existing types that become requestable: `job.apply`, `job.rescanSkipped` (plus optional
  `jobKeys`), `job.retryFailed`, `inbox.review` (its payload already takes `messageIds`),
  `upwork.syncInbox`, and `search.discover` (Run now).
- `REQUESTABLE_TASK_TYPES`, and `USER_DRIVEN_TASK_TYPES`: `chat.reply`, `question.answered`,
  `promotion.post`, plus anything from a request.
- Priorities: `chat.reply` 1100, requests 1050 (oldest first), `question.answered` stays at 1000.

**API**

1. `PUT /api/pilot/autopilot {on}` replaces `POST /start` and `/stop`. Turning it on still requires
   goals. The `state.changed` payload carries `autopilot`, and `GET /api/pilot/activity` drops
   `running`.
2. `TaskListService.getCurrent` and `refresh` stop returning 409 when autopilot is off
   (`tasks/task-list.service.ts:98,116`). `buildTaskList` takes `autopilot`, the requests and the
   chat task. With autopilot off it returns only user-driven tasks.
3. Requests:
   - `RequestService` plus `POST /api/pilot/requests {taskType, payload}`, which validates against
     `REQUESTABLE_TASK_TYPES` and the payload schema. Add `gather-requests.ts`.
   - `RunService.start` marks the request running. `postResult`, `cancel` and expiry finish it.
   - Events: `request.created` and `request.updated`.
4. Messages:
   - `POST /api/pilot/messages {body}` stores a user message and publishes `message.created`.
   - `gather-chat.ts` emits one `chat.reply` for the newest user message that has no pilot message
     after it, so a burst of messages gets one reply.
   - In `postResult`, a `chat.reply` run's `detail.reply` (markdown) becomes the pilot's message.
5. `POST /api/pilot/runs/:id/interrupt` and `POST /api/pilot/runs/:id/steer {text}` publish
   `run.interrupt` and `run.steer`.
6. Thread: add `message` and `request` item types.

**Host** (`apps/terminal`)

1. Pairing replaces running:
   - Delete `PilotSettings.Running`. An old `pilot.json` still parses; the unknown field is
     ignored.
   - `/pilot/start` becomes `/pilot/pair {provider, apiToken, apiUrl, webUrl, userId}`, and
     `/pilot/stop` becomes `/pilot/unpair`, which deletes the settings.
   - `PilotStatus` drops `Running` and gains `UserId` and `HeldUntil`.
2. `PilotLoop` runs whenever paired. `RunOnceAsync` stops gating on `activity.Running`. Delete
   `StandingDownReport` and the stand-down path.
3. `PilotEventListener` streams while paired:
   - `ShouldWake` adds `message.created`, `request.created` and `state.changed`. Delete
     `IsRemoteStop`.
   - `run.interrupt {runId}`: if it's the current run, type a stop line, then cancel the run.
     `/runs/:id/cancel` already reverts a job stuck in `applying`.
   - `run.steer {runId, text}`: type the text into the session after stripping control characters
     and newlines, capped at 1,000 characters.
4. The hold:
   - `TerminalRelay` records user input on each browser `input` message
     (`Sessions/TerminalRelay.cs:258`).
   - `CycleRunner` doesn't start a new run within 3 minutes of user input. It journals one
     "Waiting while you use the terminal" line and reports `HeldUntil` in `/healthz`.
   - A run already in progress keeps going.
5. Delete `/sessions/inject`, `InjectRequest` and the session's inject method.
6. `dotnet test` covers: the loop runs when paired, the listener's wake and interrupt/steer
   handling, the hold, and steer sanitizing. Update `apps/terminal/README.md`.

**Plugin**

1. `plugin/skills/pilot/tasks/chat.reply.md`:
   - Read the last 20 messages and the state, and answer from API data.
   - An explicit instruction becomes an applied change (`POST /api/pilot/changes`, source
     `chat`). Anything the user didn't clearly ask for becomes a proposal (`propose: true`).
   - Work the user asks for becomes requests.
   - Return the reply in `detail.reply`. Never touch rules or goals unless asked.
2. New task files that delegate to the existing skills:
   - `resume.extract` → `../../extract-resume/SKILL.md`, and `resume.tailor`
   - `networking.find` and `networking.rewrite` → `../../networking/SKILL.md`. `networking.find`
     gets the standing networking campaign from `POST /api/networking/campaign`.
     `networking.rewrite` looks up each message's campaign, so a selection that spans campaigns
     works.
   - `upwork.profile`, `upwork.proposal`, `upwork.submit`
   - Update `job.rescanSkipped.md` for `jobKeys`.
3. `search.setup.md` and `campaign.tune.md` write searches through `POST /api/pilot/changes`
   (source `pilot`, with a `name`). `campaign.tune` may move `minScore` only through a proposal.
4. `pilot/SKILL.md`: document changes, requests and `detail.reply`.

**Web**

1. `providers/agent-provider.tsx`: delete `inject` and `injectSkill`. When the host is reachable
   but not paired to the signed-in user, fetch the terminal token and call `/pilot/pair`. Delete
   `injectCommand`, `pilotStart` and `pilotStop` from `lib/terminal/client.ts` and
   `pilot/use-pilot-controls.ts`.
2. A `useCreateRequest` mutation replaces all 24 calls, plus the Find contacts dialog added in
   Phase 2:

| Call site | Request |
|---|---|
| `onboarding/resume-upload-step.tsx:37`, `resumes/detail/extraction-card.tsx:28`, `resumes/extract-resume-button.tsx:24`, `resumes/resumes-list.tsx:55` | `resume.extract` |
| `resumes/tailor/job-description-dialog.tsx:25` | `resume.tailor` |
| `inbox/inbox-table.tsx:132`, `inbox/inbox-toolbar.tsx:36` | `inbox.review` (one message, or all pending) |
| `networking/networking-board.tsx:82` (moved to Networking → Messages in Phase 2), `networking/networking-message-dialog.tsx:97` | `networking.rewrite` |
| the Find contacts dialog added in Phase 2 | `networking.find` |
| `upwork/inbox/inbox-list.tsx:86` | `upwork.syncInbox` |
| `upwork/profile/profile-enhancer.tsx:56`, `upwork/profile/profile-review.tsx:119` | `upwork.profile` |
| `upwork/proposals/proposal-composer.tsx:51`, `upwork/proposals/proposal-detail.tsx:107` | `upwork.proposal` |
| `upwork/proposals/proposal-detail.tsx:115` | `upwork.submit` |
| campaign composer, actions bar, jobs panel, rescan dialog (7 calls) | deleted in Phase 2; the Pipeline drawer uses `job.apply`, `job.rescanSkipped`, `job.retryFailed` |

3. Composer: `POST /api/pilot/messages`. The link chip calls `POST /api/pipeline/links`. Show
   "Pilot is replying…" while a `chat.reply` run is active.
4. Status line:
   - Pause/Resume goes through `PUT /api/pilot/autopilot`.
   - Interrupt and Tell this task go through the run routes.
   - Show "Waiting while you use the terminal · Hand back" when the host reports a hold.
5. After a request, show a toast that links to the thread instead of opening the terminal.

**Tests**: autopilot gating in `buildTaskList` (off means user-driven tasks only); `gather-chat`
coalescing; a request's status follows its run (done, failed, cancelled, expired).

## Phase 6: Notices

1. `GET /api/pilot/notices` is computed on read from live data, with no table and no cron job.
   - Each notice is `{key, title, body, action}`. An action creates a request, sends a chat
     message, proposes a change, or opens a link.
   - Dismissal: `POST /api/pilot/notices/:key/dismiss` stores `{key: until}` for 14 days in a new
     `pilot_states.dismissed_notices` jsonb column.
2. The first signals, in order. Skip a later signal while an earlier one shows that its data
   can't be trusted.

| Key | When | Action |
|---|---|---|
| `email.missing` | no connected email account | link to Settings → Email |
| `inbox.unread` | unclassified mail older than 2 days (the set `tasks/gather-inbox.ts` reads) | request `inbox.review` |
| `outcomes.none` | 25+ applications in 21 days, inbox current, 0 in screening, interviewing or offer, and 0 recruiter replies | message: "Look at my last 25 applications and tell me why I'm not getting replies." |
| `score.nearMiss` | 10+ jobs in 14 days scored within 5 below `minScore` | propose `rules.set {minScore: minScore - 5}` |
| `cap.unused` | autopilot on for 7 days, average applied per day under 25% of the cap, nothing approved and waiting | message: "Find more jobs that fit my goals." |

3. Web: the Heads up section in the right column.

**Tests**: each signal's thresholds, and the gate that skips a signal when its data isn't current.

## Phase 7: Readable live steps

1. **Spike first.**
   - Turn on tool-detail export for both CLIs (env in `plugin/settings/claude.json`, the otel
     config in `plugin/settings/codex.json`). Confirm the setting names against each CLI's docs.
   - Capture the OTLP payloads `/v1/logs` receives during one `job.apply` and one
     `search.discover` run per provider.
   - Write down the tool event names and which arguments arrive.
2. Host: a pure `StepMapper` (tool name plus arguments → a short label), unit-tested.
   - Playwright `browser_navigate` → "Opened <host/path>", `browser_click` → "Clicked <element>",
     form fills → "Filled N fields".
   - `jobpilot-api` calls → labels like "Recorded the application". A subagent start → "Started
     job-applier".
   - Labels only: never typed values, page text or query strings.
   - During a run, batch steps every 2 seconds to `POST /api/pilot/runs/:id/steps`.
3. API:
   - Check that the run is open and belongs to the user.
   - Keep the last 100 steps per run in memory. The API is one container, and its SSE broker
     (`common/sse/server.ts`) is already in memory with `Last-Event-ID` replay.
   - Publish `run.steps`, and serve `GET /api/pilot/runs/:id/steps` for late joiners.
4. Web: the Steps tab in the agent drawer. The status line shows the latest step.

## Phase 8: Docs, remaining nav moves, release

1. Move `/boards` to `/settings/boards`, and `/portfolio` to `/documents/portfolio` (a tab next to
   Resumes and Cover letters). Update `shell-config.ts` and every link.
2. Docs:
   - Rewrite `app/(public)/docs/pilot/page.mdx`: home, chat, autopilot, Needs you, Pipeline, Goals
     & rules, the agent drawer.
   - Update `app/(public)/docs/campaigns-and-skills/page.mdx`: the composer is gone, and skills
     still run when typed in the terminal.
   - Update getting started: pairing is automatic.
3. Wording pass, so "campaign" no longer reaches users:
   - `analytics/analytics-view.tsx:62` ("No failed campaign jobs recorded.").
   - The task titles in `tasks/task-defs.ts` that the status line and the thread show ("Review
     paused campaign", "Tune campaign").
   - The **Summary** lines in `plugin/skills/pilot/tasks/*.md`, e.g. `campaign.tune.md`.
   - The rest of `git grep -i campaign` over `apps/web/src/components` and the API's user-facing
     messages.
4. CHANGELOG, then the `release` skill (one version for host and plugin).

## Deploy

| Batch | Phases | Ships | Notes |
|---|---|---|---|
| A | 1-4 | API + web, plus a plugin patch release for the Phase 2 links | Old hosts keep working: start/stop, task refresh and the inject endpoint are unchanged until batch B. |
| B | 5-8 | API + web + host + plugin release | Old hosts stand down once the API drops `running` from `/api/pilot/activity`, and the update banner gets them current. Say so in the release notes. Dry-run the migrations on a prod dump first. |

## Out of scope

- A postings table. Phase 2 removes duplicates on write and when reading the list.
- Durable campaigns above searches.
- Renaming Campaign (about 2,100 lines in 217 files). If wanted, make it a separate refactor after
  batch B, since the redesign first deletes most of the campaign UI. Merge each search into its
  standing campaign at the same time.
- A second session lane, and a browser screencast tab.
- A model running on the server.
- Restructuring Upwork or Analytics. Networking gets only the Phase 2 fixes.
