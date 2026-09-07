# Ideas backlog

Captured 2026-09-07 from a brainstorm. Nothing here is approved or scheduled. Each idea ends
with a first step so it can be picked up cold. The old `docs/roadmap/` was deleted on
2026-09-06 (commit `4eb506b6`). Items it already listed are not repeated: learning flywheel,
ATS playbooks, shared job index, ghost-job detection, eval lab, budget governor, salary
negotiation, FormIR receipts, MCP tool server, scout/apply pipeline, model routing.

## 1. Product and fleet

The lever behind most of these: a fleet of local agents sharing cloud state, and a user who
answers from a phone.

### Moonshots

1. **Candidate agent card.** Publish a signed, consented endpoint per user with availability,
   a structured profile, and a question channel. Employer screening agents query it. The pilot
   answers inside the mandate, and the rest becomes a `PilotQuestion` of a new `screening`
   kind. The candidate becomes queryable by every recruiter agent instead of sending ten
   applications a day.
   First step: a machine-readable card on the portfolio page plus one rate-limited ask route.

2. **Application beacons.** Every application carries a unique portfolio link. A visit is an
   engagement signal days before any reply. The portfolio reorders itself around that posting's
   keywords for the visitor. This yields far more outcome labels than replies alone, which was
   the data shortage that got per-user bandits rejected.
   First step: a beacon token on the application, one visit handler, and an
   `application.engaged` agenda kind that pulls the follow-up forward.

3. **Fleet experiments.** Assign a tactic at claim grant time: cover letter or none, resume
   length, follow-up on day 3 or day 7. Pool outcomes across users and turn the winners into
   evidence-backed mandate defaults. Per-user data is noise. The fleet is a sample.
   First step: an experiments table and the arm assignment in
   `apps/api/src/modules/pilot/agenda/grant.ts`.

### Fleet-only

4. **Crowding signal.** The server can count how many pilots target one posting. Use crowd size
   and posting age in the priority. When two users hit the same job, vary the angle so the
   letters do not read as one model. Jobs are already indexed by url, so the count is one query.

5. **Referral cooperative.** Contacts across users form a graph. When one user targets a company
   where another user has a warm contact, ask the second user to make the intro. Opt-in, and
   anonymous until accepted.
   First step: an opt-in flag on contacts, a `networking.introRequest` question for the
   contact owner, and a `networking.warmIntro` item for the applicant once accepted.

6. **Employer responsiveness.** The inbox scanner sees replies, rejections, and silence for the
   whole fleet. Publish per-company reply rate and time to first reply. Time follow-ups from
   it and demote employers that never answer.
   First step: aggregate from application events and show it on the job detail page.

7. **Idle compute donation.** When a user's agenda is empty, hand that pilot a discovery slice
   nobody crawled this hour. Each local browser becomes a crawler node and the server is the
   scheduler.
   First step: a `search.discoverShared` agenda kind gated on `emptyReason === "clear"`.

### Close the loop

8. **Counterfactual skill lift.** Scoring is deterministic, so adding one skill and rescoring
   every seen job is cheap. Tell the user which single skill would move the most target jobs
   above their minimum score. Then have the pilot draft a micro-project spec that makes the new
   claim credible.
   First step: loop candidate skills through `apps/api/src/modules/scoring/fit.ts` over the
   last 30 days of jobs.

9. **Flight recorder.** Save a Playwright trace per application. Let the user scrub it on the
   phone with the pilot's narration beside it. It builds trust, settles disputes, and every
   failed trace is a free fixture for an eval lab.
   First step: save a trace in the job-worker and upload it as an application document.

10. **Verifiable receipts.** Each submitted application gets a public receipt: the candidate
    authorized it, reviewed it on a date, under a named agent version. Recruiters are turning
    hostile to agent spam, and a checkable receipt is the counter.
    First step: a signed receipt id in the letter footer and a `/receipts/:id` page.

11. **Policy the server enforces.** Goals are free text, so the model can talk itself past
    them. Add a small structured policy: company blocklist, salary floor, no relocation, no
    clearance jobs. Evaluate it in `grant.ts` before any claim is granted.

12. **Autopsy and debrief.** A rejection triggers an autopsy of resume against posting, timing,
    and fleet outcomes at that company. It ends in one hypothesis and one experiment for idea 3.
    After an interview, a sixty-second debrief extracts the questions asked into an anonymized
    per-company bank that feeds `interview.prep` for everyone.
    First step: two agenda kinds, `application.autopsy` and `interview.debrief`, triggered by
    inbox status changes.

Suggested start: beacons (2), because 3, 4, 6, and 12 need the outcome data they produce. The
agent card (1) is the flagship to build toward.

## 2. Pilot agent: efficiency, intelligence, autonomy

### Efficiency

1. **Headless runs with structured events.** The host injects a skill into a TUI and scrapes
   the PTY for the sentinel. That is why it needs the repeated-line detector, the two-minute
   completion poll, and the double Enter for Codex. Both CLIs offer a clean mode the host does
   not use:

   ```
   claude -p --output-format stream-json --mcp-config <file>
   codex exec --json --output-last-message <file>
   ```

   The host would see every tool call and the exact cost per cycle. "Stuck" becomes "same tool
   call three times" instead of "six repeated lines". Codex can force the final message into a
   JSON schema, which makes the sentinel a typed result. Keep the terminal panel by rendering
   the event stream.
   First step: a runner in `apps/terminal/Pilot/` that spawns print mode for one cycle and
   treats the final JSON message as the sentinel.

2. **Cycle packets.** Each agenda item sends the agent back to the API for the job, profile,
   resume, and prior letters. Have the server assemble one packet per item, trimmed to a token
   budget, so a cycle makes one read.
   First step: `GET /api/pilot/agenda/:itemId/packet`.

3. **Batch cycles.** One item per cycle pays for the skill read and browser warmup every time.
   Let the agenda mark items that share a board and kind as a batch of up to three. The agent
   claims and releases each in turn, so a crash loses one item, not the batch.

4. **Fail-fast order in the job worker.** `plugin/agents/job-worker.md` tailors the resume and
   writes the letter before it opens the form. Sponsorship and clearance questions often
   surface only on the form. Open the form first, screen its questions against the profile,
   and only then spend tokens on documents.

5. **Liveness probe without a model.** Let the host fetch each approved posting URL with a
   plain HTTP request before the item enters the agenda. A closed posting costs one request
   instead of one cycle.

6. **Per-kind time budgets.** The sentinel timeout is 20 minutes for every kind. The cost panel
   already knows the median per kind. Send a p90-based budget in each item and let the host
   enforce it.

### Intelligence

7. **Job fact sheet once per job.** Scoring is a skills overlap, which cannot read "hybrid
   three days in Austin" or "clearance required". Extract a structured fact sheet per job once
   (location mode, seniority, sponsorship, comp, hard blockers, the angle to pitch) and store
   it. Scoring, tailoring, and any later autopsy read the same record.

8. **Expected value instead of fixed priorities.** Priority is a constant per kind plus the
   match score. Add freshness decay, employer responsiveness, and crowding. A fresh posting at
   a company that replies should outrank a stale one with a slightly better score. Start with
   hand weights and tune them from outcomes later.

9. **Predict, then get scored.** Have the agent write a decision record per application: why
   this job, the angle, and its own probability of a reply. Compare with outcomes monthly. An
   agent that sees its own calibration stops overreaching.

10. **A failure note on the subject.** When a claim fails, the agent writes one line of what it
    tried and where it broke on the job itself. The retry reads it first.

### Autonomy

11. **Provisional answers.** For low-risk question kinds, the pilot states its intended answer
    and proceeds unless the user objects before a deadline. Never for 2FA or send approvals.
    Pair it with precedents: an answered question becomes a reusable fact, so the same question
    is never asked twice.

12. **Submission intent check.** The claim gates the start of a cycle, but a cycle runs for
    many minutes and the final click is unguarded. Right before submitting, the agent posts an
    intent with the payload summary. The server checks caps, duplicates, and policy in one
    transaction and gets the last word. A receipt falls out for free.

13. **Two lanes on one machine.** Run a browser lane and a text-only lane as separate sessions.
    The claims table already makes this safe. A captcha in the browser lane then no longer
    stops letters and networking drafts.
    First step: a lane filter on the agenda.

14. **Board circuit breaker.** Three identical failures on one board in a day pause that board
    for a day, with one journal note. Today the item comes back after each cooldown. This is
    automatic and temporary, unlike the manual parking removed on 2026-07-22.

15. **Skills served by the API.** The host already writes bundled skills to disk before each
    Codex launch. Fetch them from the API instead, versioned. A prompt fix then reaches every
    user without a plugin release, and prompt experiments can run per fleet segment.

Suggested start: idea 1, since 6, 10, and 13 get much simpler once the host has structured
events. Idea 4 is the cheapest win and needs only a reorder in the job-worker agent.

## 3. Campaigns

### How it works today

One campaign is one query on one board in one mode (`search`, `auto-apply`, `apply`,
`networking`). It starts `in_progress` and can move to `paused`, `completed`, or `failed`.
`query` doubles as the display name, so apply campaigns synthesize one from the pasted hosts.
Jobs belong to exactly one campaign, so the same posting found twice is two rows. The pilot
creates one campaign per `PilotSearch` inside `search.discover`, and the server auto-completes
it after ten idle minutes. Approval is automatic above `minScore` for `auto-apply` and `apply`
sources, and manual for `search` and `networking`. Upwork is a `search` campaign pinned to
`upwork.com` and routed to a different skill. There is no campaign list page. The workspace
shows Active and Completed cards.

### Review

The campaign is a run container named like an intent. A user reads "campaign" as "my push for
senior backend roles". The code means "one execution of one skill". The pilot widens the gap:
it creates a campaign per search, lets it idle to `completed`, and creates another on the next
run. The Completed list fills with near-identical rows, and the user's actual intent (the
search, or the goal behind it) has no page.

The changelog records the cost of this: duplicate campaigns when a query was rewritten, a
detail page titled by uuid, the funnel removed as too heavy, the single-apply queue folded in,
docs written to explain queue versus campaigns, and goals changes that leave searches, campaigns,
and approved jobs behind. Config is a guarded whole-blob replace because the pilot's strategy
review and a user edit could clobber each other.

Two smaller problems sit underneath. Jobs are not deduplicated across campaigns, which blocks a
cross-campaign jobs view and any crowding signal. And `skipped` covers both "below score" (a
decision) and "captcha" (an execution failure), which the skip-reason buckets patch over.

### Ideas

1. **Split intent from run.** Make the campaign the durable target segment: a name, title
   family, locations, seniority, base resume variant, its own `minScore` and share of the daily
   cap, a deadline, and a target count. Today's rows become runs under it (search run, apply
   batch, outreach run). Pilot searches hang under a campaign instead of spawning one each.
   First step: a `Run` table with today's `Campaign` columns, one migration that creates a
   campaign per `PilotSearch` and per manual campaign, then moves jobs.

2. **One posting per user.** One `JobPosting` row per normalized url or fuzzy company+title,
   scored per campaign membership. A posting seen by two searches shows once with one status.
   This gives an All Jobs page and makes the crowding and fleet ideas possible.
   First step: a `postings` table, `Job.postingId`, backfilled by the applied-duplicates matcher.

3. **Targets and pace.** A campaign carries a goal: N applications or N interviews by a date.
   The summary shows pace ("at this rate: 28 of 40"). The pilot's ranking favors campaigns
   behind pace. Completion becomes "goal met" or "deadline passed" instead of "idle for ten
   minutes".

4. **A brief per campaign.** A short generated brief: who you are for this segment, the angle,
   projects to mention, dealbreakers, salary band. Tailoring and letters start from it, which
   also memoizes half the tailoring work.
   First step: a `brief` text on the campaign, written by the pilot's strategy review and
   editable by the user.

5. **Diagnosis with one-tap fixes.** Turn the reason breakdown into advice with a button each:
   "30 of 42 fell below 60 and the median was 52, lower to 55?", "this board returned nothing
   three runs in a row, drop it?", "8 applied, no replies in 14 days, try a different angle?".
   The pilot's `campaign.strategyReview` already computes part of this.
   First step: `GET /api/campaigns/:id/diagnosis` from the summary and skip buckets.

6. **Search yield loop.** Each pilot search keeps found, qualified, applied, and replied counts.
   Retire searches with zero yield after N runs, clone the best query to other boards, and
   propose rewrites.
   First step: a `yield` on `PilotSearch` updated by `run-result`.

7. **Networking and Upwork as lanes, not campaign kinds.** Outreach is a lane inside a
   campaign: for these postings, find contacts and draft. Upwork is a board with a
   proposal-shaped apply lane. Remove `networking` from `CampaignSource` and give
   `UpworkProposal` a real foreign key. This matches the cross-campaign Networking page.

8. **Share a link from the phone.** Register the web app as a PWA share target. Sharing a
   posting from the LinkedIn app creates a posting, assigns it to the best-scoring campaign,
   and the pilot applies. This replaces the pasted-URL apply campaign with a stream of picks.
   First step: `share_target` in the manifest and a `POST /api/postings/share` route.

9. **Outcome strip per campaign.** applied, replied, interviewing, offer, from application
   events. The removed funnel counted job statuses and was heavy. Outcomes are the numbers that
   matter, and they let two campaigns be compared. Keep it to one row of four numbers.

10. **Separate decision from execution on a job.** Give a job a `decision` (auto-approved,
    user-approved, auto-rejected, user-rejected) and an `attempt` outcome (applied, failed,
    blocked). Analytics and the autopsy then read cleanly, and `needs_user` stops being both a
    status and an outcome.

11. **Goals change as a campaign diff.** With campaigns as durable intents, saving new goals
    produces a diff: keep A, retire B, add C, with the pilot's reason for each. This replaces
    the three retire toggles in the goals-change dialog.

12. **Hygiene now, before any remodel.** Add `name` so `query` stops doubling as one. Expose
    `pilotSearchId` in the campaign schema so the web can group runs under their search. Show a
    pilot campaign that finished a run as "waiting for the next search" rather than
    "completed". Add a list page with filters and rename. About a day of work, and it removes
    most of the confusion the changelog records.

### Suggested order

Idea 12 first. Then 1 and 2 together, since they share one migration. Then 3, 4, and 5, which
only make sense once a campaign is durable. The rest follow.
