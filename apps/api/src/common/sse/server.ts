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

/** Async generator of a channel's events. Wrap with Elysia `sse()` in the route. */
export function subscribe<C extends AnyChannel>(
  channel: C,
  params: ChannelTopicParams<C>,
): AsyncGenerator<ChannelEvent<C>, void, unknown> {
  return busFor(channel).subscribe(channel.topic(params));
}
