// Category bases; job.apply is offset by matchScore so higher scores sort first, still under escalations.
export const PRIORITY = {
  escalation: 1000,
  jobBase: 800,
  outreachSend: 700,
  inboxTriage: 650,
  promoPost: 600,
  warmIntro: 550,
  discover: 500,
  followup: 400,
  promoCompose: 300,
  finalize: 100,
} as const;

export const MAX_ITEMS = 10;
/** A job needs a strong match before its company is worth a warm-intro detour. */
export const WARM_INTRO_MIN_SCORE = 85;
/** At most one warm intro and one followup burst per agenda so a single cycle stays focused. */
export const MAX_WARM_INTROS = 1;
export const MAX_FOLLOWUPS = 2;

/** Idle poll cadence has a floor so a tiny `checkIntervalMinutes` can't spin the loop. */
export const MIN_IDLE_SLEEP_SECONDS = 30;
/** When work is queued the agent should return quickly after finishing it. */
export const ACTIVE_SLEEP_SECONDS = 15;
