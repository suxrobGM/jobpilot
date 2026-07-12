import { logger } from "@/common/logger";

/** Token-bucket state for one key. `tokens` is fractional; refill is lazy, computed on read. */
interface Bucket {
  tokens: number;
  updatedAt: number;
}

export interface TakeResult {
  allowed: boolean;
  /** Seconds until one token is available again. 0 when allowed. */
  retryAfter: number;
}

export interface RateLimitPolicy {
  /**
   * Unique id. It is both the Elysia plugin name and the store id, so every attach point of one
   * policy shares a budget. Elysia dedupes plugins by name - two differently-configured limiters
   * sharing a name would silently collapse into one (the trap `requireRole` sidesteps).
   */
  readonly name: string;
  /** Sustained allowance: `limit` requests per `windowMs`. */
  readonly limit: number;
  readonly windowMs: number;
  /** Bucket capacity - what a fully-idle key may spend at once. Defaults to `limit`. */
  readonly burst?: number;
  readonly message?: string;
}

/** An unbounded table keyed by client IP is itself a DoS, so each limiter's is capped. */
const MAX_KEYS = 20_000;
const EVICT_BATCH = 1_000;

const stores = new Map<string, RateLimitStore>();

export function storeFor(policy: RateLimitPolicy): RateLimitStore {
  const existing = stores.get(policy.name);
  if (existing) {
    return existing;
  }
  const store = new RateLimitStore(policy);
  stores.set(policy.name, store);
  return store;
}

/** Sweep every limiter's table. Driven by the rate-limit cron. */
export function sweepAllStores(now = Date.now()): number {
  let removed = 0;
  for (const store of stores.values()) {
    removed += store.sweep(now);
  }
  return removed;
}

/**
 * In-process token bucket. Chosen over a sliding log (which lets the attacker choose our memory)
 * and a fixed window (which allows a 2x burst across the window edge): O(1) memory per key, no
 * timers, an exact `Retry-After`, and `burst` as a first-class knob.
 *
 * Single-process only - a multi-instance deployment would need a shared store.
 */
export class RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  private readonly capacity: number;
  private readonly refillPerMs: number;
  /** Time for an empty bucket to refill completely - also the idle-eviction threshold. */
  private readonly fullRefillMs: number;

  constructor(readonly policy: RateLimitPolicy) {
    this.capacity = policy.burst ?? policy.limit;
    this.refillPerMs = policy.limit / policy.windowMs;
    this.fullRefillMs = Math.ceil(this.capacity / this.refillPerMs);
  }

  get size(): number {
    return this.buckets.size;
  }

  /** Spend one token for `key`. */
  take(key: string, now = Date.now()): TakeResult {
    const bucket = this.buckets.get(key);

    if (!bucket) {
      this.reserve(now);
      // A key we've never seen is indistinguishable from a full bucket.
      this.buckets.set(key, { tokens: this.capacity - 1, updatedAt: now });
      return { allowed: true, retryAfter: 0 };
    }

    const tokens = Math.min(
      this.capacity,
      bucket.tokens + (now - bucket.updatedAt) * this.refillPerMs,
    );
    bucket.updatedAt = now;

    if (tokens < 1) {
      bucket.tokens = tokens;
      // Round up, so a client that honors Retry-After is never rejected twice.
      const waitMs = (1 - tokens) / this.refillPerMs;
      return { allowed: false, retryAfter: Math.max(1, Math.ceil(waitMs / 1000)) };
    }

    bucket.tokens = tokens - 1;
    return { allowed: true, retryAfter: 0 };
  }

  /** Drop buckets idle long enough to have fully refilled - they carry no state a fresh key wouldn't. */
  sweep(now = Date.now()): number {
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt >= this.fullRefillMs) {
        this.buckets.delete(key);
        removed++;
      }
    }
    return removed;
  }

  /** Make room for a new key: sweep idle buckets, then drop the oldest inserted. */
  private reserve(now: number): void {
    if (this.buckets.size < MAX_KEYS) {
      return;
    }
    this.sweep(now);
    if (this.buckets.size < MAX_KEYS) {
      return;
    }
    // Someone is churning keys. Fail *open* on memory pressure: 429-ing every new key would let
    // key-churn lock out the real users, which is worse than a few reset buckets.
    let dropped = 0;
    for (const key of this.buckets.keys()) {
      this.buckets.delete(key);
      if (++dropped >= EVICT_BATCH) {
        break;
      }
    }
    logger.warn(
      { limiter: this.policy.name, dropped, size: this.buckets.size },
      "Rate-limit table full; evicted oldest buckets",
    );
  }
}
