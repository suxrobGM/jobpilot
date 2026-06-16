import { sse } from "elysia";

/** Topic-based in-process SSE pub/sub. Each topic maps to its own subscriber set. */
export interface SseBroker<TEvent> {
  /** Send `event` to every subscriber of `topic`. No-op if there are none. */
  publish(topic: string, event: TEvent): void;
  /** Async generator of RAW events for `topic`. Serve via Elysia `sse()`. */
  subscribe(topic: string): AsyncGenerator<TEvent, void, unknown>;
}

interface SseBrokerOptions {
  /** Heartbeat interval in ms. Default 15s. Set 0 to disable. */
  heartbeatMs?: number;
}

/** Per-subscriber mailbox: buffered events + a resolver to wake the generator. */
interface Subscriber<TEvent> {
  queue: TEvent[];
  /** Resolves the current wakeup promise; null while the generator is draining. */
  wake: (() => void) | null;
  closed: boolean;
}

// Named control events. EventSource `onmessage` only fires for the default
// (unnamed) event, so these are invisible to the client. `connected` is yielded
// first so Elysia's eager first `next()` resolves immediately and the Response
// opens (EventSource `onopen`) without waiting for the first domain event.
const CONNECTED = sse({ event: "connected" });
const PING = sse({ event: "ping" });

/**
 * In-process SSE broker. Events are not persisted or replayed across
 * connections, and the broker only spans a single process — multi-instance
 * deployments need a shared bus (e.g. Redis pub/sub).
 */
export function createSseBroker<TEvent = unknown>(
  options: SseBrokerOptions = {},
): SseBroker<TEvent> {
  const subscribers = new Map<string, Set<Subscriber<TEvent>>>();
  const heartbeatMs = options.heartbeatMs ?? 15_000;

  const remove = (topic: string, sub: Subscriber<TEvent>): void => {
    const set = subscribers.get(topic);
    if (!set) {
      return;
    }

    set.delete(sub);
    if (set.size === 0) {
      subscribers.delete(topic);
    }
  };

  return {
    publish(topic, event) {
      const set = subscribers.get(topic);
      if (!set) {
        return;
      }

      for (const sub of set) {
        sub.queue.push(event);
        sub.wake?.();
      }
    },

    async *subscribe(topic) {
      // Register synchronously, before the first await — no events are missed
      // between subscribe-time and the first suspension.
      const sub: Subscriber<TEvent> = { queue: [], wake: null, closed: false };
      let set = subscribers.get(topic);
      if (!set) {
        set = new Set();
        subscribers.set(topic, set);
      }
      set.add(sub);

      // Heartbeat as a queue sentinel (not a raced timer) so the single `finally`
      // clears it with no leak.
      const heartbeat =
        heartbeatMs > 0
          ? setInterval(() => {
              sub.queue.push(PING as unknown as TEvent);
              sub.wake?.();
            }, heartbeatMs)
          : undefined;

      try {
        yield CONNECTED as unknown as TEvent; // open the stream immediately
        while (!sub.closed) {
          if (sub.queue.length > 0) {
            // Drain the current batch before awaiting again.
            const batch = sub.queue;
            sub.queue = [];
            for (const event of batch) {
              yield event;
            }
            continue;
          }

          // Buffer empty: await a fresh wakeup promise.
          await new Promise<void>((resolve) => {
            sub.wake = resolve;
          });
          sub.wake = null;
        }
      } finally {
        // Runs on iterator.return() from request abort, stream cancel, or completion.
        sub.closed = true;
        sub.wake = null;
        if (heartbeat) {
          clearInterval(heartbeat);
        }
        remove(topic, sub);
      }
    },
  };
}
