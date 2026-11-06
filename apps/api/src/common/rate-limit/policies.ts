import { byEmail, byEmailAndIp, byIp, byUser, type RateLimitPolicy } from "./limiter";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Sized for a human plus headroom for a shared NAT, never for a script. `/auth/logout` has no limit:
 * it is idempotent, and throttling it could leave a user half-logged-out.
 */
export const RATE_LIMITS = {
  /** Keyed by email and IP so one attacker can't lock out everyone behind the same office NAT. */
  loginPerAccount: {
    key: byEmailAndIp,
    limit: 5,
    windowMs: 15 * MINUTE,
    message: "Too many sign-in attempts for this account. Try again in a few minutes.",
  },

  /** Password spraying: many emails from one host. Loose, so a real office never trips it. */
  loginPerIp: { key: byIp, limit: 30, windowMs: 15 * MINUTE },

  /** Account farming. A human registers once; 5/hour still covers a family or a demo booth. */
  register: { key: byIp, limit: 5, windowMs: HOUR },

  /** Sends mail, so it could spam a victim. Per-IP stops a script; per-email stops many hosts
   *  flooding one inbox. */
  forgotPerIp: { key: byIp, limit: 5, windowMs: HOUR },
  forgotPerEmail: { key: byEmail, limit: 3, windowMs: HOUR },

  /** The tokens are high-entropy, so this only caps the cost of hammering the DB lookup. */
  passwordReset: { key: byIp, limit: 10, windowMs: HOUR },
  emailVerify: { key: byIp, limit: 20, windowMs: HOUR },

  /** Authed, but sends mail on every call, so the axis is the known caller. */
  emailResend: {
    key: byUser,
    limit: 3,
    windowMs: HOUR,
    message: "Verification email already sent. Check your inbox, then try again later.",
  },

  /** OAuth start + callback: public redirects, so keyed by IP; loose enough for retries. */
  oauthStart: { key: byIp, limit: 20, windowMs: 15 * MINUTE },

  /** Caps a stolen session brute-forcing the current password. */
  passwordChange: { key: byUser, limit: 10, windowMs: HOUR },

  /** Sends mail to an arbitrary address the caller typed, so tight like emailResend. */
  emailChange: { key: byUser, limit: 3, windowMs: HOUR },

  /** Magic-link consumption; same shape as passwordReset (high-entropy token, DB-cost cap). */
  emailChangeConfirm: { key: byIp, limit: 10, windowMs: HOUR },

  /** The only public route that does real work: a cache miss re-renders the PDF. The uuid is the
   *  access key, so this slows replay of a leaked link; a recruiter reloading it never trips it. */
  publicResumePdf: { key: byIp, limit: 30, windowMs: HOUR, burst: 10 },

  /** Sized for a crawler walking the paginated job index; any tighter and search engines drop us. */
  publicJobs: { key: byIp, limit: 1800, windowMs: HOUR, burst: 120 },

  /** Portfolio and leaderboard pages are crawlable too, so sized like publicJobs. */
  publicPortfolio: { key: byIp, limit: 1800, windowMs: HOUR, burst: 120 },

  /** Landing-page totals. Cached server-side, so this only caps a script hammering it. */
  publicStats: { key: byIp, limit: 600, windowMs: HOUR, burst: 30 },

  /** Spends the user's own solver credits, so this guards against a runaway agent. Burst 5 covers
   *  a page with several challenges; `maxInFlight` stops two-minute solves piling up under the cap. */
  captchaSolve: {
    key: byUser,
    limit: 60,
    windowMs: HOUR,
    burst: 5,
    maxInFlight: 2,
    message: "Too many CAPTCHA solves in flight. Slow the loop down.",
  },

  /** Pilot polls the task list once per cycle; burst covers a tight run-then-repoll loop. */
  pilotTasks: { key: byUser, limit: 240, windowMs: HOUR, burst: 10 },

  /** Batched journal writes, several per cycle - the loosest Pilot limit. */
  pilotJournal: { key: byUser, limit: 600, windowMs: HOUR, burst: 20 },

  /** Streams every row, and is rarely needed. */
  pilotJournalExport: { key: byUser, limit: 10, windowMs: HOUR },

  /** Run/heartbeat/finish bookkeeping, a few per worked item. */
  pilotRun: { key: byUser, limit: 240, windowMs: HOUR, burst: 10 },
  /** The host posts a run's steps every 2 seconds while it works. */
  pilotSteps: { key: byUser, limit: 2400, windowMs: HOUR, burst: 20 },

  /** User- or agent-driven Pilot mutations (instructions, enable, questions) - infrequent. */
  pilotMutation: { key: byUser, limit: 120, windowMs: HOUR },

  /** Timeline notes such as interview prep sheets are infrequent. */
  applicationNote: { key: byUser, limit: 120, windowMs: HOUR },
} as const satisfies Record<string, RateLimitPolicy>;
