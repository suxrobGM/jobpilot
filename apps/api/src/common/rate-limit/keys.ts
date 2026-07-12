import type { RateLimitContext } from "./limiter";

/**
 * The caller's IP.
 *
 * Prod: nginx (deploy/jobpilot.conf) sets `X-Real-IP $remote_addr`, which *replaces* any
 * client-supplied value - so it is trustworthy. `X-Forwarded-For` is built with
 * `$proxy_add_x_forwarded_for`, which *appends* to whatever the client sent, so its leftmost entry
 * is attacker-controlled: never key on XFF.
 *
 * Reading the header is mandatory, not a nicety: the API runs inside a container, so
 * `server.requestIP()` returns the docker bridge gateway for every proxied request - one bucket for
 * the entire user base.
 *
 * Dev: no proxy, so fall back to the socket peer. A dev client could forge `x-real-ip`, but dev is
 * loopback-only. If the API is ever exposed without nginx in front, gate the header read behind a
 * TRUST_PROXY flag.
 */
export function clientIp(ctx: RateLimitContext): string {
  const realIp = ctx.headers["x-real-ip"]?.trim();
  if (realIp) {
    return realIp;
  }
  return ctx.server?.requestIP(ctx.request)?.address ?? "unknown";
}

/** A bucket key, or `null` to skip the check for this request. */
export type RateLimitKey = (ctx: RateLimitContext) => string | null;

/** Per source IP - the default axis for unauthenticated routes. */
export const byIp: RateLimitKey = (ctx) => `ip:${clientIp(ctx)}`;

/** Per authenticated user - the right axis when a route spends the *user's own* resources. */
export const byUser: RateLimitKey = (ctx) =>
  ctx.user ? `user:${ctx.user.id}` : `ip:${clientIp(ctx)}`;

/** Per (email, IP). Throttles stuffing against one account without punishing everyone else behind
 *  the same office NAT / CGNAT because of one bad actor. */
export const byEmailAndIp: RateLimitKey = (ctx) => {
  const email = readEmail(ctx.body);
  return email ? `email:${email}|ip:${clientIp(ctx)}` : null;
};

/** Per email. Stops a mail-bomb on one victim from a rotating IP pool. */
export const byEmail: RateLimitKey = (ctx) => {
  const email = readEmail(ctx.body);
  return email ? `email:${email}` : null;
};

/** Length-bounded so the key itself can't be used to blow up the table (RFC 5321 caps at 320). */
function readEmail(body: unknown): string | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const value = (body as { email?: unknown }).email;
  return typeof value === "string" && value.length > 0 && value.length <= 320
    ? value.toLowerCase()
    : null;
}
