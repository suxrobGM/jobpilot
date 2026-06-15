
type Subscriber = ReadableStreamDefaultController<Uint8Array>;

const encoder = new TextEncoder();

/** Topic-based SSE pub/sub. Each topic maps to its own subscriber set. */
export interface SseBroker<TEvent> {
  /** Send `event` to every subscriber of `topic`. No-op if there are none. */
  publish(topic: string, event: TEvent): void;
  /** Open an SSE-encoded stream for `topic`. Caller serves it as `text/event-stream`. */
  subscribe(topic: string): ReadableStream<Uint8Array>;
}

interface SseBrokerOptions {
  /** Heartbeat comment interval in ms. Default 15s. */
  heartbeatMs?: number;
}

function formatEvent(event: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function formatComment(comment: string): Uint8Array {
  return encoder.encode(`: ${comment}\n\n`);
}

/**
 * In-process SSE broker. Events are not persisted or replayed across
 * connections, and the broker only spans a single Next.js process —
 * multi-instance deployments need a shared bus (e.g. Redis pub/sub).
 */
export function createSseBroker<TEvent = unknown>(
  options: SseBrokerOptions = {},
): SseBroker<TEvent> {
  const subscribers = new Map<string, Set<Subscriber>>();
  const cleanups = new Map<Subscriber, () => void>();
  const heartbeatMs = options.heartbeatMs ?? 15_000;

  const remove = (topic: string, controller: Subscriber): void => {
    const current = subscribers.get(topic);
    if (!current) {
      return;
    }

    current.delete(controller);
    if (current.size === 0) {
      subscribers.delete(topic);
    }
  };

  return {
    publish(topic, event) {
      const set = subscribers.get(topic);
      if (!set) {
        return;
      }

      const chunk = formatEvent(event);
      for (const sub of set) {
        try {
          sub.enqueue(chunk);
        } catch {
          cleanups.get(sub)?.();
        }
      }
    },

    subscribe(topic) {
      let cleanup = () => {};

      return new ReadableStream<Uint8Array>({
        start(controller) {
          let set = subscribers.get(topic);
          if (!set) {
            set = new Set();
            subscribers.set(topic, set);
          }
          set.add(controller);

          controller.enqueue(formatComment("connected"));

          const heartbeat = setInterval(() => {
            try {
              controller.enqueue(formatComment("ping"));
            } catch {
              cleanup();
            }
          }, heartbeatMs);

          cleanup = () => {
            clearInterval(heartbeat);
            cleanups.delete(controller);
            remove(topic, controller);
          };
          cleanups.set(controller, cleanup);
        },

        cancel() {
          cleanup();
        },
      });
    },
  };
}
