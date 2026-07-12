import { byEmail, byEmailAndIp, byIp, byUser } from "./keys";
import type { RateLimitOptions } from "./limiter";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/**
 * Every limit in one place. `name` must be unique - it is both the Elysia plugin name and the store
 * id. Sized for a human at a keyboard plus a generous multiple for a shared NAT, never for a
 * script's happy path.
 */
export const RATE_LIMITS = {
  /** Credential stuffing against one account. Keyed by (email, IP) so one bad actor can't lock out
   *  everyone else behind the same office/CGNAT address. */
  loginPerAccount: {
    name: "login-account",
    key: byEmailAndIp,
    limit: 5,
    windowMs: 15 * MINUTE,
    message: "Too many sign-in attempts for this account. Try again in a few minutes.",
  },

  /** Password spraying: many emails from one host. Deliberately loose so an office sharing one
   *  egress IP never trips it. */
  loginPerIp: { name: "login-ip", key: byIp, limit: 30, windowMs: 15 * MINUTE },

  /** Account farming. A human registers once; 5/hour still covers a family or a demo booth. */
  register: { name: "register", key: byIp, limit: 5, windowMs: HOUR },

  /** Sends mail, and can be weaponized to spam a victim's inbox. Two axes: per-IP stops a script,
   *  per-email stops a distributed mail-bomb on one address. */
  forgotPerIp: { name: "forgot-ip", key: byIp, limit: 5, windowMs: HOUR },
  forgotPerEmail: { name: "forgot-email", key: byEmail, limit: 3, windowMs: HOUR },

  /** Magic-link endpoints. The tokens are high-entropy, so this caps the cost of hammering the DB
   *  lookup - it is not what makes guessing infeasible. */
  passwordReset: { name: "password-reset", key: byIp, limit: 10, windowMs: HOUR },
  emailVerify: { name: "email-verify", key: byIp, limit: 20, windowMs: HOUR },

  /** Authed, but sends mail on every call, so the axis is the known caller. */
  emailResend: {
    name: "email-resend",
    key: byUser,
    limit: 3,
    windowMs: HOUR,
    message: "Verification email already sent. Check your inbox, then try again later.",
  },

  /** Cheap and cookie-driven; exists only so a broken client retry loop can't spin the DB. */
  refresh: { name: "refresh", key: byIp, limit: 60, windowMs: 15 * MINUTE },

  /** Burns the *user's own* paid solver credits (captcha.service.ts decrypts their Credential key),
   *  so this is a runaway-agent guardrail, not an anti-abuse wall. burst 5 covers a page with
   *  several challenges. Paired with MAX_CONCURRENT_SOLVES - a rate cap alone still lets several
   *  two-minute requests pile up. */
  captchaSolve: {
    name: "captcha-solve",
    key: byUser,
    limit: 60,
    windowMs: HOUR,
    burst: 5,
    message: "Too many CAPTCHA solves in flight. Slow the loop down.",
  },
} as const satisfies Record<string, RateLimitOptions>;
