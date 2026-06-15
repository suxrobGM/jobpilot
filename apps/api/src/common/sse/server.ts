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

/** Open an SSE-encoded stream for a channel's topic. Wrap with {@link sseResponse}. */
export function subscribe<C extends AnyChannel>(
  channel: C,
  params: ChannelTopicParams<C>,
): ReadableStream<Uint8Array> {
  return busFor(channel).subscribe(channel.topic(params));
}

const SSE_HEADERS = {
  "content-type": "text/event-stream",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
} as const;

/** Wrap an SSE stream in a `Response` with the right text/event-stream headers. */
export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, { headers: SSE_HEADERS });
}
