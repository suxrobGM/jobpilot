import { byEmail, byEmailAndIp, byIp, byUser, type RateLimitPolicy } from "./limiter";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Every limit in one place. Sized for a human at a keyboard plus a generous multiple for a shared
 * NAT, never for a script's happy path. `/auth/logout` gets none - it is idempotent, and throttling
 * it could only strand a user half-logged-out.
 */
export const RATE_LIMITS = {
  /** Credential stuffing against one account. Keyed by (email, IP) so one bad actor can't lock out
   *  everyone else behind the same office/CGNAT address. */
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

  /** Sends mail, so it can be weaponized to spam a victim. Per-IP stops a script; per-email stops a
   *  distributed mail-bomb on one address. */
  forgotPerIp: { key: byIp, limit: 5, windowMs: HOUR },
  forgotPerEmail: { key: byEmail, limit: 3, windowMs: HOUR },

  /** Magic-link endpoints. The tokens are high-entropy, so this caps the cost of hammering the DB
   *  lookup - it is not what makes guessing infeasible. */
  passwordReset: { key: byIp, limit: 10, windowMs: HOUR },
  emailVerify: { key: byIp, limit: 20, windowMs: HOUR },

  /** Authed, but sends mail on every call, so the axis is the known caller. */
  emailResend: {
    key: byUser,
    limit: 3,
    windowMs: HOUR,
    message: "Verification email already sent. Check your inbox, then try again later.",
  },

  /** Cheap and cookie-driven; exists only so a broken client retry loop can't spin the DB. */
  refresh: { key: byIp, limit: 60, windowMs: 15 * MINUTE },

  /** Burns the *user's own* solver credits (captcha.service.ts decrypts their key), so this is a
   *  runaway-agent guardrail, not an anti-abuse wall. burst 5 covers a page with several
   *  challenges. Paired with MAX_CONCURRENT_SOLVES: a rate cap alone still lets several two-minute
   *  requests pile up. */
  captchaSolve: {
    key: byUser,
    limit: 60,
    windowMs: HOUR,
    burst: 5,
    message: "Too many CAPTCHA solves in flight. Slow the loop down.",
  },
} as const satisfies Record<string, RateLimitPolicy>;
