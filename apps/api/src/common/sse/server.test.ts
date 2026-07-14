// Imported directly, not via the `@/common/sse` barrel: a future db-touching re-export there would
// drag Prisma + env validation into this test and fail it at import time.
import { type InboxEvent, inboxChannel } from "@jobpilot/contracts/sse";
import { publish, subscribe } from "@/common/sse/server";
import { describe, expect, it } from "bun:test";

/** What the broker actually yields: control frames carry `event` and no id, data frames carry both. */
interface Frame {
  id?: string;
  event?: string;
  data?: InboxEvent;
}

type Stream = AsyncGenerator<unknown, void, unknown>;

/** The bus is process-wide and a topic's history outlives its last subscriber by 60s, so tests must
 *  not share profile ids or one test's events replay into the next. */
const newProfileId = () => crypto.randomUUID();

/**
 * Open a stream and drive it past its first `next()`.
 *
 * Load-bearing: `subscribe()` is an async *generator function*, so calling it registers nothing. The
 * body - which creates the topic and adds the subscriber - runs on the first `next()`, whose first
 * yield is the `connected` control frame. Publish before that and `publish()` finds no topic and
 * drops the event.
 */
async function open(profileId: string, lastEventId?: string): Promise<Stream> {
  const stream = subscribe(inboxChannel, { profileId }, lastEventId) as Stream;
  const first = (await stream.next()).value as Frame;
  expect(first.event).toBe("connected");
  return stream;
}

/** Never races a timer: frames are queued, so `next()` settles even if the publish already happened. */
async function nextFrame(stream: Stream): Promise<Frame> {
  return (await stream.next()).value as Frame;
}

/** Runs the generator's `finally`, which clears the 15s heartbeat interval and detaches the subscriber. */
async function closeAll(...streams: Stream[]): Promise<void> {
  await Promise.all(streams.map((s) => s.return()));
}

describe("inbox SSE channel is per-profile", () => {
  it("does not deliver one profile's live events to another profile's subscriber", async () => {
    const alice = newProfileId();
    const bob = newProfileId();

    const a = await open(alice);
    const b = await open(bob);

    try {
      publish(inboxChannel, { profileId: alice }, { type: "message.scanned", id: "alice-secret" });

      // Published after Alice's event, on Bob's own topic. Delivery per subscriber is FIFO, so any
      // leaked frame would necessarily sit *ahead* of this sentinel - ordering, not a timeout.
      publish(inboxChannel, { profileId: bob }, { type: "message.scanned", id: "bob-sentinel" });

      const firstOnBob = await nextFrame(b);
      expect(firstOnBob.data).toEqual({ type: "message.scanned", id: "bob-sentinel" });

      // Isolation must not mean "delivers nothing": Alice still gets her own event.
      const firstOnAlice = await nextFrame(a);
      expect(firstOnAlice.data).toEqual({ type: "message.scanned", id: "alice-secret" });
    } finally {
      await closeAll(a, b);
    }
  });

  it("keeps the reconnect replay buffer per profile", async () => {
    const alice = newProfileId();
    const bob = newProfileId();

    // Both topics need a live subscriber to exist at all - publish() no-ops on an unknown topic.
    const a = await open(alice);
    const b = await open(bob);

    try {
      publish(inboxChannel, { profileId: alice }, { type: "message.scanned", id: "alice-1" });
      publish(inboxChannel, { profileId: alice }, { type: "message.scanned", id: "alice-2" });
      publish(inboxChannel, { profileId: bob }, { type: "message.scanned", id: "bob-1" });

      // A Bob client reconnecting with Last-Event-ID replays his topic's history. Under the old
      // constant topic there was one shared history and `alice-1` would replay here first.
      const reconnected = await open(bob, "0");

      try {
        const replayed = await nextFrame(reconnected);
        expect(replayed.data).toEqual({ type: "message.scanned", id: "bob-1" });

        // Replay yields before the live loop, so a sentinel published now proves the replay run
        // ended after exactly one entry - i.e. none of Alice's history was in it.
        publish(
          inboxChannel,
          { profileId: bob },
          { type: "message.reviewed", id: "bob-2", status: "approved" },
        );
        const live = await nextFrame(reconnected);
        expect(live.data).toEqual({ type: "message.reviewed", id: "bob-2", status: "approved" });
      } finally {
        await closeAll(reconnected);
      }
    } finally {
      await closeAll(a, b);
    }
  });
});
