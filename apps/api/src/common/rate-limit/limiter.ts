import { tooManyRequests } from "@/common/errors";

/** The slice of Elysia's context a limiter reads. Structural, so one hook fits any route. */
export interface RateLimitContext {
  request: Request;
  server: { requestIP(request: Request): { address: string } | null } | null;
  headers: Record<string, string | undefined>;
  body?: unknown;
  user?: { id: string };
}

/** How requests are bucketed. `null` skips the check for this request. */
type RateLimitKey = (ctx: RateLimitContext) => string | null;

export interface RateLimitPolicy {
  /** Sustained allowance: `limit` requests per `windowMs`. */
  limit: number;
  windowMs: number;
  /** What a fully-idle key may spend at once. Defaults to `limit`. */
  burst?: number;
  /** Simultaneous in-flight requests per key, enforced by `acquireSlot` in the service. */
  maxInFlight?: number;
  message?: string;
  key: RateLimitKey;
}

/**
 * Mandatory, not a nicety: the API runs in a container, so `requestIP()` is the docker bridge gateway
 * for every proxied request - one bucket for the whole user base. nginx *replaces* `X-Real-IP`, so it
 * is trustworthy; never read `X-Forwarded-For`, which nginx appends to (leftmost entry is spoofable).
 */
function clientIp(ctx: RateLimitContext): string {
  const realIp = ctx.headers["x-real-ip"]?.trim();
  return realIp || ctx.server?.requestIP(ctx.request)?.address || "unknown";
}

export const byIp: RateLimitKey = (ctx) => `ip:${clientIp(ctx)}`;

export const byUser: RateLimitKey = (ctx) =>
  ctx.user ? `user:${ctx.user.id}` : `ip:${clientIp(ctx)}`;

/** Throttles stuffing against one account without punishing everyone behind a shared office NAT. */
export const byEmailAndIp: RateLimitKey = (ctx) => {
  const email = readEmail(ctx.body);
  return email === null ? null : `email:${email}|ip:${clientIp(ctx)}`;
};

/** Stops a mail-bomb on one victim from a rotating IP pool. */
export const byEmail: RateLimitKey = (ctx) => {
  const email = readEmail(ctx.body);
  return email === null ? null : `email:${email}`;
};

/** Length-bounded so the key itself can't be used to blow up the table (RFC 5321 caps at 320). */
function readEmail(body: unknown): string | null {
  const value = (body as { email?: unknown } | null | undefined)?.email;
  return typeof value === "string" && value.length > 0 && value.length <= 320
    ? value.toLowerCase()
    : null;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** An unbounded table keyed by client IP is itself a DoS. */
const MAX_KEYS = 10_000;
/** Headroom left after a sweep, so the O(n) scan runs once per this many new keys, not per request. */
const EVICT_HEADROOM = 1_000;

const DEFAULT_MESSAGE = "Too many requests. Slow down and try again shortly.";

/**
 * A `beforeHandle` hook that spends one token for this request's key and throws 429 (carrying
 * Retry-After) when the bucket is empty. Each call owns its own table, so attach one per route.
 *
 * Token bucket, in memory, single-process: O(1) per key, no timers, an exact Retry-After, and `burst`
 * as a knob. Beats a sliding log (lets the attacker size our memory) and a fixed window (allows a 2x
 * burst across the window edge).
 *
 * `beforeHandle`, not `derive`: the body is parsed *and validated* by then - which the email keys
 * need - so a malformed body 422s without spending anyone's token.
 */
export function rateLimit(policy: RateLimitPolicy): (ctx: RateLimitContext) => void {
  const buckets = new Map<string, Bucket>();
  const capacity = policy.burst ?? policy.limit;
  const refillPerMs = policy.limit / policy.windowMs;
  const message = policy.message ?? DEFAULT_MESSAGE;
  /** Idle this long and a bucket has fully refilled - indistinguishable from a key never seen. */
  const idleMs = Math.ceil(capacity / refillPerMs);

  const evict = (now: number): void => {
    for (const [key, bucket] of buckets) {
      if (now - bucket.updatedAt >= idleMs) {
        buckets.delete(key);
      }
    }
    // Still near capacity: someone is churning keys. Drop the oldest inserted (Map keeps insertion
    // order) rather than refuse to track the new one, which would leave it unthrottled entirely.
    for (const key of buckets.keys()) {
      if (buckets.size <= MAX_KEYS - EVICT_HEADROOM) {
        break;
      }
      buckets.delete(key);
    }
  };

  const take = (key: string): number => {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket) {
      if (buckets.size >= MAX_KEYS) {
        evict(now);
      }
      // A key we've never seen is indistinguishable from a full bucket.
      buckets.set(key, { tokens: capacity - 1, updatedAt: now });
      return 0;
    }

    const tokens = Math.min(capacity, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
    bucket.updatedAt = now;

    if (tokens >= 1) {
      bucket.tokens = tokens - 1;
      return 0;
    }

    bucket.tokens = tokens;
    // Round up, so a client that honors Retry-After is never rejected twice.
    return Math.max(1, Math.ceil((1 - tokens) / refillPerMs / 1000));
  };

  return (ctx) => {
    const key = policy.key(ctx);
    if (key === null) {
      return;
    }
    const retryAfter = take(key);
    if (retryAfter > 0) {
      throw tooManyRequests(message, retryAfter);
    }
  };
}

const inFlight = new Map<string, number>();

/**
 * Cap concurrent in-flight work for one key; returns a release fn to call in a `finally`.
 *
 * A token bucket bounds *rate*, not simultaneity: a burst of slow requests can still park several
 * sockets at once. Deliberately not a lifecycle hook - none is guaranteed to run when the client
 * aborts mid-request, and a leaked counter would lock the user out for good.
 */
export function acquireSlot(key: string, max: number): () => void {
  const current = inFlight.get(key) ?? 0;
  if (current >= max) {
    throw tooManyRequests(
      "Too many requests already in flight. Wait for the current ones to finish.",
      30,
    );
  }
  inFlight.set(key, current + 1);

  let released = false;
  return () => {
    if (released) {
      return; // a double release would decrement someone else's slot
    }
    released = true;
    const next = (inFlight.get(key) ?? 1) - 1;
    if (next <= 0) {
      inFlight.delete(key); // self-emptying, so no sweep needed
    } else {
      inFlight.set(key, next);
    }
  };
}
