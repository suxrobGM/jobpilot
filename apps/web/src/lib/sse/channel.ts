/**
 * Pure-data descriptor of an SSE channel — safe to import from client and
 * server. `TUrlParams` and `TTopicParams` differ when the topic key is
 * server-resolved (e.g. from the session) and absent from the URL.
 */
export interface Channel<
  _TEvent extends { type: string },
  TUrlParams = void,
  TTopicParams = TUrlParams,
> {
  /** Unique channel id; used as the in-process bus key. */
  readonly name: string;
  /** Build the SSE endpoint URL the client connects to. */
  url(params: TUrlParams): string;
  /** Compute the broker topic key the server publishes/subscribes on. */
  topic(params: TTopicParams): string;
}

/** Type-checked identity helper. Anchors generics so call sites stay terse. */
export function defineChannel<
  TEvent extends { type: string },
  TUrlParams = void,
  TTopicParams = TUrlParams,
>(config: Channel<TEvent, TUrlParams, TTopicParams>): Channel<TEvent, TUrlParams, TTopicParams> {
  return config;
}

/** Constraint for generic functions that accept any channel descriptor. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentional wildcard supertype
export type AnyChannel = Channel<any, any, any>;
/** Event union carried by a channel. */
export type ChannelEvent<C> = C extends Channel<infer E, infer _U, infer _T> ? E : never;
/** URL-param type of a channel (what the client passes). */
export type ChannelUrlParams<C> = C extends Channel<infer _E, infer U, infer _T> ? U : never;
/** Topic-param type of a channel (what the server resolves). */
export type ChannelTopicParams<C> = C extends Channel<infer _E, infer _U, infer T> ? T : never;
