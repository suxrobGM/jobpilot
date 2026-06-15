"use client";

import { useEffect, useRef } from "react";
import type { AnyChannel, ChannelEvent, ChannelUrlParams } from "./channel";

/**
 * Hook input for a channel's URL params. Channels with no URL params
 * (`TUrlParams = void`) take `null` at the call site as an explicit "no
 * params" marker; typed channels still require their full param object.
 */
type UrlParamsArg<C extends AnyChannel> =
  void extends ChannelUrlParams<C> ? null : ChannelUrlParams<C>;

interface UseEventSourceOptions<TEvent> {
  /** When false, the hook stays mounted without opening a connection. */
  enabled?: boolean;
  /** Convert the raw `data` string into the event. Defaults to `JSON.parse`. */
  parse?: (data: string) => TEvent;
  /** Called for each parsed message. */
  onMessage?: (event: TEvent, raw: MessageEvent<string>) => void;
  /** Called when EventSource reports a connection error or reconnect attempt. */
  onError?: (event: Event) => void;
  /** Called when `parse` throws for an incoming message. */
  onParseError?: (error: unknown, raw: MessageEvent<string>) => void;
}

function parseJson<TEvent>(data: string): TEvent {
  return JSON.parse(data) as TEvent;
}

/**
 * Subscribe to a raw SSE stream by URL. Prefer {@link useSseChannel} when
 * you have a channel descriptor; reach for this only when the URL is dynamic
 * or you want fully opaque message handling.
 */
export function useEventSource<TEvent = unknown>(
  url: string | null | undefined,
  options: UseEventSourceOptions<TEvent> = {},
): void {
  const parseRef = useRef(options.parse ?? parseJson<TEvent>);
  const onMessageRef = useRef(options.onMessage);
  const onErrorRef = useRef(options.onError);
  const onParseErrorRef = useRef(options.onParseError);

  useEffect(() => {
    parseRef.current = options.parse ?? parseJson<TEvent>;
    onMessageRef.current = options.onMessage;
    onErrorRef.current = options.onError;
    onParseErrorRef.current = options.onParseError;
  }, [options.parse, options.onMessage, options.onError, options.onParseError]);

  useEffect(() => {
    if (options.enabled === false || !url) {
      return;
    }

    const source = new EventSource(url);
    source.onmessage = (event) => {
      try {
        onMessageRef.current?.(parseRef.current(event.data), event);
      } catch (err) {
        onParseErrorRef.current?.(err, event);
      }
    };
    source.onerror = (event) => {
      onErrorRef.current?.(event);
    };
    return () => source.close();
  }, [url, options.enabled]);
}

type SseHandlers<TEvent extends { type: string }> = Partial<{
  [K in TEvent["type"]]: (event: Extract<TEvent, { type: K }>) => void;
}>;

interface UseSseChannelOptions<TEvent extends { type: string }> {
  /** When false, the hook stays mounted without opening a connection. */
  enabled?: boolean;
  /** Called for every event, regardless of type. Fires before `on[type]`. */
  onMessage?: (event: TEvent) => void;
  /** Per-event-type handlers. Exhaustively type-checked against the channel's event union. */
  on?: SseHandlers<TEvent>;
}

/**
 * Subscribe to a typed channel. URL comes from the descriptor; `on`
 * dispatches by `event.type` with full type narrowing per variant.
 */
export function useSseChannel<C extends AnyChannel>(
  channel: C,
  params: UrlParamsArg<C>,
  options: UseSseChannelOptions<ChannelEvent<C>> = {},
): void {
  type TEvent = ChannelEvent<C>;
  const url = options.enabled === false ? null : channel.url(params as ChannelUrlParams<C>);

  useEventSource<TEvent>(url, {
    enabled: options.enabled,
    onMessage: (event) => {
      options.onMessage?.(event);
      const handler = options.on?.[event.type as TEvent["type"]] as (e: TEvent) => void;
      handler?.(event);
    },
  });
}
