/**
 * Pure-data descriptor of an SSE channel - safe to import from client and
 * server.
 */
export interface Channel<_TEvent extends { type: string }, TUrlParams = void> {
  /** Unique channel id; used as the in-process bus key. */
  readonly name: string;
  /** Build the SSE endpoint URL the client connects to. */
  url(params: TUrlParams): string;
}

/** Type-checked identity helper. Anchors generics so call sites stay terse. */
export function defineChannel<TEvent extends { type: string }, TUrlParams = void>(
  config: Channel<TEvent, TUrlParams>,
): Channel<TEvent, TUrlParams> {
  return config;
}

/** Constraint for generic functions that accept any channel descriptor. */
// biome-ignore lint/suspicious/noExplicitAny: intentional wildcard supertype
export type AnyChannel = Channel<any, any>;
/** Event union carried by a channel. */
export type ChannelEvent<C> = C extends Channel<infer E, infer _U> ? E : never;
/** URL-param type of a channel (what the client passes). */
export type ChannelUrlParams<C> = C extends Channel<infer _E, infer U> ? U : never;
