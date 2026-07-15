# The Pilot — one generic autonomous loop (north star)

Status: **in-progress** (M1 started 2026-07-15) · This is the unifying architecture. The former
T2 plumbing and T5 reflex items are absorbed here (consolidation 2026-07-15); their unique
detail lives in the sections below. Full implementation plan with per-milestone deliverables:
the approved plan of 2026-07-15 (see Notes).

## The idea

One **perpetual sense → decide → act → record → exit cycle** manages everything — campaigns,
queue, inbox, outreach, self-promotion, escalations, schedules — autonomously. The user states
goals once (the mandate); the Pilot runs the job search. Each cycle is stateless (fresh context,
all state server-side) and does ONE agenda item.

1. **Sense** — `GET /api/pilot/agenda`: server-compiled, prioritized, compact world state.
   Compiled on read from existing domain rows (no task table, no server cron — lazy lease and
   escalation expiry run inside compilation, like the stale-campaign reconciler).
2. **Decide** — take the top item; the LLM breaks ties against the mandate and picks proactive
   work when the agenda is quiet.
3. **Act** — delegate to job-worker / outreach-worker (one worker, one browser activity per
   cycle). Discovery is batched (board tab lives and dies within one cycle); applies are
   per-job against the stored URL.
4. **Record** — existing endpoints plus the **pilot journal**: an auditable narrative feed
   ("resumed job X — your salary answer arrived"). Journal entries are structured
   (kind/subject/detail) so they double as the future learning system's episodic capture.
5. **Exit** — the skill prints a sentinel line
   `[[JOBPILOT_CYCLE cycle=<uuid> status=ok|empty|error sleep=<seconds>]]`; the host's
   **PilotConductor** re-injects the skill after a clamped sleep. The conductor is also the
   deterministic watchdog (no sentinel → nudge → kill + restart; lease TTL recovers the work).

## Key architecture decisions (settled 2026-07-15, don't re-litigate)

- **Generic `PilotLease`** (kind + subject + TTL + payload), not a campaign-scoped lease
  endpoint — it must cover jobs, outreach sends, inbox batches, discovery runs. Leases exist
  for crash/watchdog recovery, not concurrency. Grant flips the domain row (job → `applying`);
  expiry reverts it.
- **Escalations are their own model** (kind, question, options, deepLink, expiry, answer);
  jobs also gain a `needs_user` status so parked work is visible. Answered escalations rank
  first on the agenda.
- **Scheduling is server-side** in the mandate/agenda (`sleepSeconds`/`nextWakeAt` from
  activeHours + standing-query cadence) — not host cron. A phone edit to the mandate changes
  behavior next cycle; the host keeps one bit: enabled.
- **One-time host pairing** solves "browser tab must be open": Enable Pilot posts the reusable
  terminal token to the host (`POST /pilot/enable`), stored DPAPI/0600; the conductor
  self-starts sessions on boot/crash/wake.
- **Hard limits at server chokepoints** (apply cap at lease grant; outreach caps + never
  auto-send InMail in the send endpoint). Mandate text only steers the LLM.

## The mandate (the user's charter)

One small, user-editable document in the dashboard:

- **Goals**: "senior TypeScript remote role, ≥$150k, by October."
- **Effort**: daily apply cap, active hours, check interval, standing queries.
- **Boundaries**: autonomy per outreach channel (email draft/review/auto; LinkedIn never
  auto-InMail), boards to avoid, promotion venues + cadence.
- **Escalation prefs**: push vs. morning digest.

Soft judgment lives in the mandate text; hard limits are ALSO enforced server-side so prompt
drift can never exceed them.

## Where the absorbed items landed

| Former item | Landed as |
| --- | --- |
| t2-job-leases | Generic `PilotLease` (M1) — deliberately job-level, not step-level (see deferred.md) |
| t2-stateless-step-loop | The pilot skill + conductor sentinel loop (M1) |
| t2-needs-user-escalation | `Escalation` model + `needs_user` job status (M1); phone answering (M2) |
| t2-web-push | M2 (`PushSubscription`, VAPID, service worker) |
| t2-scheduled-runs | Server-side mandate scheduling (M1) — host cron rejected |
| t4-mobile-decision-inbox | M2 mobile escalation inbox: push tap → one-decision card → parked job resumes |
| t4-warm-path-finder | M3, scoped: free `GET /api/contacts?company=X` check before every apply; active discovery only for score ≥85, mandate-gated |
| t4-multi-machine-fleet | Free once leases exist — the lease is the mutex. Document + test two hosts draining one campaign with no duplicate applications |
| t5-supervisor-watchdog | The PilotConductor (M1 basic: 20-min sentinel timeout → nudge → kill; M4 heuristics: repeated-output/error loops, skip directive) |
| t5-standing-query-campaigns | Mandate `standingQueries` → `search.discover` agenda items (M1); event-wake latency (M4). Metric: time-from-posting-to-application |
| t5-strategist-loop | `campaign.strategyReview` agenda kind (M4): low-yield telemetry summary → LLM rewrites query/tunes minScore, written back as auditable campaign events, server-bounded |
| t5-circuit-breakers | Board-health agenda items (M4): server counts consecutive per-board failures → "probe in careful mode or park with a user-facing reason" |
| t5-speculative-prep | Future policy: during browser waits, precompute next leased job's artifacts (resume variant, cover letter — needs lease peek). Cheapest win once leases exist; do after M4 |
| t5-graduated-autonomy | Future mandate/delegation policy: per-board trust ladder observe→propose→supervised→autonomous, advanced by verified receipts, server-enforced in the lease payload |
| t5-gearbox-effort-control | Future delegation policy: per-cycle gear (cheap model + replay on familiar boards; strong model + exploration on unknown ATS), shifts down on surprise mid-job |
| t5-failures-become-fixtures | Learning capture (pilot-learning.md step 1): journal + worker `observations[]` (M3) persist redacted traces; one command promotes a failure to an eval fixture (with t1-eval-lab) |

## What stays outside the Pilot

- **Workers** (job-worker / outreach-worker): isolation for token reasons; the Pilot delegates
  exactly as orchestrator skills do today.
- **PilotConductor watchdog layer**: deterministic on purpose — something non-LLM must watch
  the watcher.
- **Server-side hard limits**: the Pilot proposes, the API disposes.
- Existing skills remain manual entry points; the Pilot supersedes rather than replaces them.

## Self-improvement

Designed in [pilot-learning.md](pilot-learning.md) (capture → reflect → commit → validate →
adopt → share over tiered memory with decay, shadow validation, auto-rollback, never-touch
list). M1–M5 build only the capture hooks (structured journal, worker observations, frozen
`subjectKey` conventions `board:<domain>` / `ats:<domain>`); the flywheel itself comes after.
Outcome calibration (interview rate by score band/board/variant, pooled priors before any
bandit — see deferred.md) is the strategy tier of that system.

## Build path (approved plan 2026-07-15)

| Status | Milestone | Hook |
| --- | --- | --- |
| done | **M1 — Pilot spine** | mandate → agenda → lease → cycle → journal; conductor + pairing; the killer demo |
| done | **M2 — Away-proof** | web push, phone-answerable escalations, unattended nights |
| done | **M3 — Full surface** | inbox triage, outreach + warm path, self-promotion (PromotionPost, draft-first), 7am digest |
| done | **M3.5 — Interview autonomy** | invite → availability reply (approval card) + auto prep sheet via `interview` skill |
| done | **M4 — Event wake + proactive** | SSE→inject wake, stall heuristics, strategy review, board health, rescan/retry |
| done | **M5 — Learning-ready capture** | correction capture, journal export, subjectKey conventions frozen |

## Done when

A user writes a mandate, closes the laptop lid at night with the host running, and wakes to a
journal: applications submitted, replies triaged, two questions awaiting one-tap answers — with
zero skill invocations by the user, ever.

## Notes

- 2026-07-15 — Roadmap consolidated around the Pilot; T2/T5 item files (and four absorbed
  T3/T4 files) folded into this doc. Implementation started on branch `feat/pilot` per the
  approved M1–M5 plan (plan file: `~/.claude/plans/i-would-like-to-lively-deer.md`).
- 2026-07-15 — M1 shipped (fd185cd + 1f645cb): pilot module (agenda/lease/journal/escalations,
  SSE), PilotConductor + sentinel loop + host pairing, pilot skill, /pilot dashboard page.
  M2 shipped (f221460): web push (VAPID, service worker, device management), system-journal
  reporting from the host watchdog, startup resume, structured needs_user escalations,
  2FA self-expiry, live escalation badges. Code gates green; the live overnight smoke test
  (real board, host running, lid closed) is still pending — run it before starting M3.
- 2026-07-15 — M3 (7dbe434), M3.5 (3b654e3), M4 (34f5aa5), M5 (413963b) shipped: full agenda
  surface (inbox triage, outreach send/followup/warm-intro, promo compose/post — posting
  explicitly user-authorized, review-gated), interview reply+prep, SSE event wake, three-rung
  stall ladder (nudge → skip → kill), proactive quiet-agenda work (strategy review, board
  health probe-or-park via parkedBoards, rescan/retry, queue drain), admin fleet view,
  correction capture + NDJSON journal export + frozen subjectKeys. All M1–M5 code-complete;
  the LIVE OVERNIGHT SMOKE TEST remains the outstanding gate before calling the Pilot done.
