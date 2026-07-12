import { Elysia } from "elysia";
import { tooManyRequests } from "@/common/errors";
import type { RateLimitKey } from "./keys";
import { type RateLimitPolicy, storeFor } from "./store";

/**
 * The slice of the Elysia context a limiter reads. Declared structurally as a supertype of the real
 * context, so one hook drops into any route regardless of its body schema or derived values.
 */
export interface RateLimitContext {
  request: Request;
  server: { requestIP(request: Request): { address: string } | null } | null;
  headers: Record<string, string | undefined>;
  body?: unknown;
  user?: { id: string };
}

export interface RateLimitOptions extends RateLimitPolicy {
  /** How requests are bucketed. Returning null skips the check for this request. */
  key: RateLimitKey;
}

const DEFAULT_MESSAGE = "Too many requests. Slow down and try again shortly.";

/**
 * A `beforeHandle` hook that spends one token for this request's key and throws 429 (carrying
 * `Retry-After`) when the bucket is empty.
 *
 * `beforeHandle`, not `derive`: the body is parsed *and validated* by then, which the email-composite
 * keys need, and a malformed body 422s without spending anyone's token.
 *
 * Attach per route for exact coverage, or per instance via {@link rateLimit}.
 */
export function rateLimitHook(options: RateLimitOptions): (ctx: RateLimitContext) => void {
  const store = storeFor(options);
  const message = options.message ?? DEFAULT_MESSAGE;

  return (ctx) => {
    const key = options.key(ctx);
    if (key === null) {
      return;
    }
    const { allowed, retryAfter } = store.take(key);
    if (!allowed) {
      throw tooManyRequests(message, retryAfter);
    }
  };
}

/**
 * Plugin form, for applying one policy to every route of an instance (see captchaController).
 *
 * The hook is scoped, so it covers the using instance's routes *from that point in the chain
 * onward* - exactly like `.use(authGuard)`. Don't chain two of these in one controller expecting
 * per-route policies: the later route would carry both. Use `rateLimitHook` per route for that.
 */
export const rateLimit = (options: RateLimitOptions) =>
  new Elysia({ name: `rate-limit-${options.name}` }).onBeforeHandle(
    { as: "scoped" },
    rateLimitHook(options),
  );
