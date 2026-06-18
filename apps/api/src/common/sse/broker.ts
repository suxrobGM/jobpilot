import { sse } from "elysia";

/** Topic-based in-process SSE pub/sub with bounded per-topic replay. */
export interface SseBroker<TEvent> {
  /** Send `event` to `topic`'s subscribers and record it for replay; no-op once the topic has evicted. */
  publish(topic: string, event: TEvent): void;
  /** SSE frames for `topic`, each tagged with a monotonic id; pass `lastEventId` to replay missed events. */
  subscribe(topic: string, lastEventId?: number | null): AsyncGenerator<TEvent, void, unknown>;
}

interface SseBrokerOptions {
  /** Heartbeat interval in ms. Default 15s. Set 0 to disable. */
  heartbeatMs?: number;
  /** Max events retained per topic for reconnect replay. Default 64. Set 0 to disable replay. */
  historyLimit?: number;
  /** How long a topic's history outlives its last subscriber, so reconnects can replay. Default 60s. */
  retentionMs?: number;
}

/** A recorded event plus its monotonic id, kept for reconnect replay. */
interface HistoryEntry<TEvent> {
  id: number;
  frame: TEvent;
}

/** Per-subscriber mailbox: buffered frames + a resolver to wake the generator. */
interface Subscriber<TEvent> {
  queue: TEvent[];
  /** Resolves the current wakeup promise; null while the generator is draining. */
  wake: (() => void) | null;
  closed: boolean;
}

/** Live subscribers plus the replay buffer and pending eviction for one topic. */
interface Topic<TEvent> {
  subscribers: Set<Subscriber<TEvent>>;
  history: HistoryEntry<TEvent>[];
  /** Set while the topic has no subscribers; fires to evict it after the retention window. */
  evict: ReturnType<typeof setTimeout> | null;
}

// Named control frames: invisible to the client's `onmessage` and id-less (never touch Last-Event-ID).
// `connected` is yielded first so the Response opens without waiting for a domain event.
const CONNECTED = sse({ event: "connected" });
const PING = sse({ event: "ping" });

/**
 * In-process SSE broker: each event gets a monotonic id and is buffered per topic, so a reconnecting
 * client replays what it missed via `Last-Event-ID`. Single-process only — multi-instance needs a shared bus.
 */
export function createSseBroker<TEvent = unknown>(
  options: SseBrokerOptions = {},
): SseBroker<TEvent> {
  const topics = new Map<string, Topic<TEvent>>();
  const heartbeatMs = options.heartbeatMs ?? 15_000;
  const historyLimit = options.historyLimit ?? 64;
  const retentionMs = options.retentionMs ?? 60_000;

  // Process-wide (not per-topic) so ids never repeat — a stale Last-Event-ID can't match a recycled topic.
  let seq = 0;

  const frameFor = (id: number, event: TEvent): TEvent =>
    sse({ id: String(id), data: event }) as unknown as TEvent;

  // Hand a frame to a subscriber and wake its generator if it's parked.
  const enqueue = (sub: Subscriber<TEvent>, frame: TEvent): void => {
    sub.queue.push(frame);
    sub.wake?.();
  };

  const detach = (topic: string, sub: Subscriber<TEvent>): void => {
    const t = topics.get(topic);
    if (!t) {
      return;
    }

    t.subscribers.delete(sub);
    if (t.subscribers.size > 0) {
      return;
    }

    // Keep the topic alive briefly so a reconnect can replay gap events; unref so it never holds the process open.
    if (retentionMs > 0) {
      const timer = setTimeout(() => topics.delete(topic), retentionMs);
      (timer as { unref?: () => void }).unref?.();
      t.evict = timer;
    } else {
      topics.delete(topic);
    }
  };

  return {
    publish(topic, event) {
      const t = topics.get(topic);
      if (!t) {
        return;
      }

      const id = ++seq;
      const frame = frameFor(id, event);

      if (historyLimit > 0) {
        t.history.push({ id, frame });
        if (t.history.length > historyLimit) {
          t.history.shift();
        }
      }

      for (const sub of t.subscribers) {
        enqueue(sub, frame);
      }
    },

    async *subscribe(topic, lastEventId) {
      // Register synchronously, before the first await — no events are missed
      // between subscribe-time and the first suspension.
      const sub: Subscriber<TEvent> = { queue: [], wake: null, closed: false };
      let t = topics.get(topic);

      if (!t) {
        t = { subscribers: new Set(), history: [], evict: null };
        topics.set(topic, t);
      }

      if (t.evict) {
        clearTimeout(t.evict);
        t.evict = null;
      }

      t.subscribers.add(sub);
      // Replay covers (lastEventId, cutoff]; live events (id > cutoff) arrive via the queue — no overlap.
      const cutoff = seq;
      const replay =
        lastEventId != null ? t.history.filter((h) => h.id > lastEventId && h.id <= cutoff) : [];

      // Heartbeat as a queue sentinel (not a raced timer) so the single `finally` clears it with no leak.
      const heartbeat =
        heartbeatMs > 0
          ? setInterval(() => enqueue(sub, PING as unknown as TEvent), heartbeatMs)
          : null;

      try {
        yield CONNECTED as unknown as TEvent; // open the stream immediately
        for (const entry of replay) {
          yield entry.frame;
        }

        while (!sub.closed) {
          if (sub.queue.length > 0) {
            // Drain the current batch before awaiting again.
            const batch = sub.queue;
            sub.queue = [];
            for (const frame of batch) {
              yield frame;
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
        detach(topic, sub);
      }
    },
  };
}
