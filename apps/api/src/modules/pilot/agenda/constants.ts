import { DAY_MS, HOUR_MS } from "@/common/date/buckets";

// Category bases; job.apply is offset by matchScore so higher scores sort first, still under questions.
export const PRIORITY = {
  question: 1000,
  interviewReply: 950,
  // Above jobBase + a perfect matchScore (900): a failing board must outrank any apply attempt.
  boardHealth: 920,
  // Also above 900: a stranded (paused) campaign must not be starved out of a full apply agenda
  // by the MAX_ITEMS cap. Below boardHealth/interviewReply: active failures and humans come first.
  reviewPaused: 910,
  jobBase: 800,
  interviewPrep: 750,
  queueDrain: 720,
  networkingSend: 700,
  inboxReview: 650,
  promoPost: 600,
  warmIntro: 550,
  // Only fires on a quiet pipeline (no apply/discover/queue), so its exact rank is cosmetic.
  strategyBootstrap: 520,
  // Scoring an existing campaign's pending rows outranks fresh discovery: finish what's found first.
  scorePending: 510,
  discover: 500,
  followup: 400,
  strategyReview: 350,
  promoCompose: 300,
  rescanSkipped: 250,
  retryFailed: 240,
} as const;

/** Board health, strategy reviews, and skipped/failed sweeps are one-per-agenda so a cycle stays focused. */
export const MAX_BOARD_HEALTH = 1;
export const MAX_STRATEGY_REVIEWS = 1;
export const MAX_RESCAN_SKIPPED = 1;
export const MAX_RETRY_FAILED = 1;
export const MAX_PROMO_COMPOSE = 1;
export const INBOX_BATCH = 10;

/**
 * Gmail-pull throttle for refresh. Matches the default check interval: idle cycles always sync,
 * busy cycles (15s sleeps) don't pull every refresh.
 */
export const INBOX_SYNC_STALE_MS = 30 * 60 * 1000;

/** One queue-drain cycle visits at most this many of a campaign's `queued` (pasted-link) rows. */
export const QUEUE_BATCH = 5;
export const REASON_CAP = 3;
/** A board is unhealthy once its most recent apply outcomes are this many failures deep. */
export const BOARD_HEALTH_MIN_FAILURES = 3;

/** Row cap for unbounded gather/expiry scans, matching the module's take: 200 list precedent. */
export const GATHER_CAP = 200;

/** One score-pending cycle visits at most this many of a campaign's rows (bounded per cycle). */
export const SCORE_PENDING_BATCH = 5;

/**
 * Minimum gap between score-pending runs on one campaign. Rows nothing can score stay `matchScore: null`
 * forever, so without a cooldown they would out-rank discovery every cycle; a backlog still drains at
 * SCORE_PENDING_BATCH per hour, far above the pilot's apply rate.
 */
export const SCORE_PENDING_COOLDOWN_MS = 60 * 60 * 1000;

export const MAX_ITEMS = 10;
/** A job needs a strong match before its company is worth a warm-intro detour. */
export const WARM_INTRO_MIN_SCORE = 80;
/** An applied job stays a warm-intro candidate this long - "I just applied" outreach still lands. */
export const WARM_INTRO_APPLIED_WINDOW_MS = 48 * HOUR_MS;
/** At most one warm intro and one followup burst per agenda so a single cycle stays focused. */
export const MAX_WARM_INTROS = 1;
export const MAX_FOLLOWUPS = 2;
/** An interview invite is time-sensitive; reply to a couple per cycle, prep one, to stay focused. */
export const MAX_INTERVIEW_REPLIES = 2;
export const MAX_INTERVIEW_PREPS = 1;

/** After any bootstrap claim, don't re-offer it for a day - stops a failing agent from looping. */
export const BOOTSTRAP_RETRY_MS = DAY_MS;

/** One paused-campaign review per agenda; multiple paused campaigns drain over successive cycles. */
export const MAX_PAUSED_REVIEWS = 1;

/** Over-fetch for the paused gather: rows come longest-paused first, so suppression rarely rejects this many. */
export const PAUSED_REVIEW_CANDIDATES = 20;

/** After any paused-review claim, don't re-offer the campaign for a day - damps resume/re-pause loops. */
export const PAUSED_REVIEW_RETRY_MS = DAY_MS;

// Crash-recovered work (a claim that ended expired/abandoned, not a deliberate outcome) retries sooner than the full damper.
export const CRASH_RETRY_MS = 2 * 60 * 60 * 1000;

/** Finalize only idle campaigns: recent job activity means someone may be mid-session on it. */
export const FINALIZE_IDLE_MS = 10 * 60 * 1000;

/** An `applying` job with no open claim and no update for this long is stranded (crashed driver). */
export const STALE_APPLYING_MS = 30 * 60 * 1000;

/**
 * How long an approved job stays worth applying to. Approved rows have no other age bound, so a
 * pilot paused for a week wakes to a backlog of dead postings ranked above everything else
 * (jobBase + matchScore). Pilot campaigns only - a user's own queue is theirs to clear.
 */
export const APPROVED_JOB_STALE_MS = 7 * DAY_MS;

/**
 * Ceiling on how long any claim may be held, heartbeats included.
 *
 * A heartbeat slides `expiresAt` forward, so a driver that is stuck but still beating never
 * expires. Two kinds showed it in real data: 26 apply claims averaged 43 minutes (one ran 18.6
 * hours with no application to show for it), and 4 `question.answered` claims were held 24.5 hours
 * - work that normally finishes in under 13 minutes, since the human has already answered by the
 * time it is queued.
 *
 * No kind of work has ever legitimately run past this: the slowest success of any kind was an
 * apply at 22.0 min (p99 18.7), then discovery at 15.9 and questions at 12.6. The margin is thin
 * enough that a healthy apply can be cut off here, so the cost is real - that attempt is released
 * rather than retried.
 */
export const MAX_CLAIM_LIFETIME_MS = 25 * 60 * 1000;

/** Each open apply claim becomes a NOT clause in the stale sweep; the pilot never holds many at once. */
export const MAX_OPEN_APPLY_CLAIMS = 20;

/** Idle poll cadence has a floor so a tiny `checkIntervalMinutes` can't spin the loop. */
export const MIN_IDLE_SLEEP_SECONDS = 30;
/** Idle sleep ceiling (6h) so a backed-off pilot still wakes to re-check within the day. */
export const MAX_IDLE_SLEEP_SECONDS = 6 * 60 * 60;
/** When work is queued the agent should return quickly after finishing it. */
export const ACTIVE_SLEEP_SECONDS = 15;

// Pilot-search discovery scheduling

/** A discovery run's new-jobs target tracks the room left under the daily apply cap, clamped here. */
export const NEW_JOBS_TARGET_MIN = 5;
export const NEW_JOBS_TARGET_MAX = 20;
/** Deepest page the crawl walks before stopping, even if the target isn't met. */
export const SEARCH_MAX_PAGES = 5;
/** A run producing this many fresh rows is "good": re-run it soon while the board is yielding. */
export const GOOD_RUN_NEW_JOBS = 3;
/** Re-run a good, still-yielding search after 2h to keep the apply queue fed. */
export const RERUN_GOOD_SEARCH_MS = 2 * HOUR_MS;
/** A thin run, or a good one that hit the board's end, waits 8h before another pass. */
export const RERUN_SLOW_SEARCH_MS = 8 * HOUR_MS;
/** Backoff ladder for consecutive empty runs (0 new jobs): 8h, 24h, then 48h and holds. */
export const EMPTY_RUN_BACKOFF_MS = [8 * HOUR_MS, 24 * HOUR_MS, 48 * HOUR_MS];
/** Hungry override floor: with room left under the apply cap, re-run a search idle this long. */
export const HUNGRY_RERUN_MS = 6 * HOUR_MS;
/** Claim damper for discovery: an in-flight/crashed run guard only, not a cadence knob. */
export const SEARCH_CLAIM_COOLDOWN_MS = 2 * HOUR_MS;
