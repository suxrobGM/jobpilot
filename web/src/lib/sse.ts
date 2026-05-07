import "server-only";

/**
 * Per-runId SSE broker. Subscribers get a ReadableStream that emits
 * structured `data:` events whenever publish() is called for the run.
 *
 * Only meaningful within a single Next.js process; for a multi-instance
 * deployment we'd need a shared bus (Redis pub/sub). Local single-user
 * tool, so in-process is fine.
 */

type Subscriber = ReadableStreamDefaultController<Uint8Array>;

const subscribers = new Map<string, Set<Subscriber>>();
const encoder = new TextEncoder();

function format(event: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function publishRunEvent(runId: string, event: unknown): void {
  const set = subscribers.get(runId);
  if (!set) return;
  const chunk = format(event);
  for (const sub of set) {
    try {
      sub.enqueue(chunk);
    } catch {
      // Subscriber went away; will be cleaned up on next close.
    }
  }
}

export function subscribeToRun(runId: string): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      let set = subscribers.get(runId);
      if (!set) {
        set = new Set();
        subscribers.set(runId, set);
      }
      set.add(controller);

      // Initial heartbeat so the client sees the connection is alive.
      controller.enqueue(encoder.encode(`: connected\n\n`));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      const cleanup = () => {
        clearInterval(heartbeat);
        const current = subscribers.get(runId);
        if (!current) return;
        current.delete(controller);
        if (current.size === 0) subscribers.delete(runId);
      };

      (controller as any).__cleanup = cleanup;
    },
    cancel(_reason) {
      // Will be called when the client disconnects; nothing else to do.
    },
  });
}
