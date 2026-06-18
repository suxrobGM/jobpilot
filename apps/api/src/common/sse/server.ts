import { sse } from "elysia";
import { createSseBroker, type SseBroker } from "./broker";
import type { AnyChannel, ChannelEvent, ChannelTopicParams } from "./channel";

const buses = new Map<string, SseBroker<unknown>>();

function busFor<C extends AnyChannel>(channel: C): SseBroker<ChannelEvent<C>> {
  let bus = buses.get(channel.name);
  if (!bus) {
    bus = createSseBroker<unknown>();
    buses.set(channel.name, bus);
  }
  return bus as SseBroker<ChannelEvent<C>>;
}

/** Publish a typed event to a channel's topic. No-op if no subscribers. */
export function publish<C extends AnyChannel>(
  channel: C,
  params: ChannelTopicParams<C>,
  event: ChannelEvent<C>,
): void {
  busFor(channel).publish(channel.topic(params), event);
}

/** A channel's event generator; pass `Last-Event-ID` to replay missed events. Prefer {@link sseStream} in routes. */
export function subscribe<C extends AnyChannel>(
  channel: C,
  params: ChannelTopicParams<C>,
  lastEventId?: string | null,
): AsyncGenerator<ChannelEvent<C>, void, unknown> {
  return busFor(channel).subscribe(channel.topic(params), parseLastEventId(lastEventId));
}

/** Open a channel's SSE stream in a route. Reads `Last-Event-ID` here so every route gets replay without restating it. */
export function sseStream<C extends AnyChannel>(
  channel: C,
  params: ChannelTopicParams<C>,
  headers: Record<string, string | undefined>,
) {
  return sse(subscribe(channel, params, headers["last-event-id"]));
}

/** Parse a `Last-Event-ID` header into a broker sequence id, ignoring junk. */
function parseLastEventId(raw?: string | null): number | undefined {
  if (raw == null) {
    return undefined;
  }
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) ? id : undefined;
}
