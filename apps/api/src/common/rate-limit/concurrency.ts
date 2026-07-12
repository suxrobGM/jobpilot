import { tooManyRequests } from "@/common/errors";

const inFlight = new Map<string, number>();

/**
 * Cap concurrent in-flight work for one key. Returns a release fn - call it in a `finally`.
 *
 * A token bucket bounds *rate*, not simultaneity: a burst of CAPTCHA solves can still park several
 * requests holding a socket for ~2 minutes each. Deliberately not an Elysia hook - no lifecycle hook
 * is guaranteed to run when a client aborts mid-poll, and a leaked counter would lock the user out
 * permanently. A `try/finally` around the awaited work is airtight.
 */
export function acquireSlot(scope: string, key: string, max: number): () => void {
  const id = `${scope}:${key}`;
  const current = inFlight.get(id) ?? 0;
  if (current >= max) {
    throw tooManyRequests(
      "Too many requests already in flight. Wait for the current ones to finish.",
      30,
    );
  }
  inFlight.set(id, current + 1);

  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    const next = (inFlight.get(id) ?? 1) - 1;
    if (next <= 0) {
      inFlight.delete(id); // self-emptying, so no sweep needed
    } else {
      inFlight.set(id, next);
    }
  };
}
