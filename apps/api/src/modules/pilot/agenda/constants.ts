import { DAY_MS } from "@/common/date/buckets";

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
  finalize: 100,
} as const;

/** Board health, strategy reviews, and skipped/failed sweeps are one-per-agenda so a cycle stays focused. */
export const MAX_BOARD_HEALTH = 1;
export const MAX_STRATEGY_REVIEWS = 1;
export const MAX_RESCAN_SKIPPED = 1;
export const MAX_RETRY_FAILED = 1;
export const MAX_PROMO_COMPOSE = 1;
export const INBOX_BATCH = 10;
export const QUEUE_BATCH = 5;
export const REASON_CAP = 3;
/** A board is unhealthy once its most recent apply outcomes are this many failures deep. */
export const BOARD_HEALTH_MIN_FAILURES = 3;

/** Row cap for unbounded gather/expiry scans, matching the module's take: 200 list precedent. */
export const GATHER_CAP = 200;

/** One score-pending cycle scores at most this many of a campaign's unscored rows (bounded per cycle). */
export const SCORE_PENDING_BATCH = 5;

/**
 * Minimum gap between score-pending runs on one campaign. Rows nothing can score stay `matchScore: null`
 * forever, so without a cooldown they would out-rank discovery every cycle; a backlog still drains at
 * SCORE_PENDING_BATCH per hour, far above the pilot's apply rate.
 */
export const SCORE_PENDING_COOLDOWN_MS = 60 * 60 * 1000;

export const MAX_ITEMS = 10;
/** A job needs a strong match before its company is worth a warm-intro detour. */
export const WARM_INTRO_MIN_SCORE = 85;
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

/** Each open apply claim becomes a NOT clause in the stale sweep; the pilot never holds many at once. */
export const MAX_OPEN_APPLY_CLAIMS = 20;

/** Idle poll cadence has a floor so a tiny `checkIntervalMinutes` can't spin the loop. */
export const MIN_IDLE_SLEEP_SECONDS = 30;
/** When work is queued the agent should return quickly after finishing it. */
export const ACTIVE_SLEEP_SECONDS = 15;
