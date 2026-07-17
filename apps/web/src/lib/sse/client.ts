"use client";

import type { AnyChannel, ChannelEvent, ChannelUrlParams } from "@jobpilot/contracts/sse";
import { EventSource } from "eventsource";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/base-url";

/** "idle" = no connection requested; "reconnecting" = the `eventsource` package is auto-retrying. */
export type SseConnectionStatus = "idle" | "connecting" | "open" | "reconnecting";

/**
 * Hook input for a channel's URL params. Channels with no URL params
 * (`TUrlParams = void`) take `null` at the call site as an explicit "no
 * params" marker; typed channels still require their full param object.
 */
type UrlParamsArg<C extends AnyChannel> =
  // biome-ignore lint/suspicious/noConfusingVoidType: probes the `TUrlParams = void` channels declare
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

interface SharedSource {
  source: EventSource;
  status: SseConnectionStatus;
  onMessage: Set<(event: MessageEvent<string>) => void>;
  onError: Set<(event: Event) => void>;
  onStatus: Set<(status: SseConnectionStatus) => void>;
}

const sharedSources = new Map<string, SharedSource>();

/** Refcount one EventSource per URL so a page with several panels holds one connection, not one per subscriber. */
function acquireSource(
  url: string,
  onMessage: (event: MessageEvent<string>) => void,
  onError: (event: Event) => void,
  onStatus: (status: SseConnectionStatus) => void,
): () => void {
  let shared = sharedSources.get(url);

  if (!shared) {
    // `eventsource` (not native) for fetch-based transport: credentialed cross-origin streams + header control.
    const source = new EventSource(url, { withCredentials: true });
    const entry: SharedSource = {
      source,
      status: "connecting",
      onMessage: new Set(),
      onError: new Set(),
      onStatus: new Set(),
    };
    shared = entry;
    sharedSources.set(url, entry);
    const setStatus = (status: SseConnectionStatus) => {
      if (entry.status === status) return;
      entry.status = status;
      for (const listener of entry.onStatus) listener(status);
    };
    // A listener may remove itself during dispatch; Sets tolerate deletion while iterating.
    source.onmessage = (event) => {
      for (const listener of entry.onMessage) listener(event);
    };
    source.onopen = () => {
      setStatus("open");
    };
    source.onerror = (event) => {
      // The `eventsource` package auto-retries, so an error means "reconnecting", not "dead".
      setStatus("reconnecting");
      for (const listener of entry.onError) listener(event);
    };
  }

  shared.onMessage.add(onMessage);
  shared.onError.add(onError);
  shared.onStatus.add(onStatus);
  // Replay the current status so late subscribers don't sit on a stale "idle".
  onStatus(shared.status);

  return () => {
    shared.onMessage.delete(onMessage);
    shared.onError.delete(onError);
    shared.onStatus.delete(onStatus);
    if (shared.onMessage.size === 0) {
      shared.source.close();
      sharedSources.delete(url);
    }
  };
}

/**
 * Subscribe to a raw SSE stream by URL. Prefer {@link useSseChannel} when
 * you have a channel descriptor; reach for this only when the URL is dynamic
 * or you want fully opaque message handling.
 */
export function useEventSource<TEvent = unknown>(
  url: string | null | undefined,
  options: UseEventSourceOptions<TEvent> = {},
): SseConnectionStatus {
  const [status, setStatus] = useState<SseConnectionStatus>("idle");
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
      setStatus("idle");
      return;
    }

    const onRawMessage = (event: MessageEvent<string>) => {
      try {
        onMessageRef.current?.(parseRef.current(event.data), event);
      } catch (err) {
        onParseErrorRef.current?.(err, event);
      }
    };
    const onRawError = (event: Event) => {
      onErrorRef.current?.(event);
    };
    return acquireSource(url, onRawMessage, onRawError, setStatus);
  }, [url, options.enabled]);

  return status;
}

type SseHandlers<TEvent extends { type: string }> = Partial<{
  [K in TEvent["type"]]: (event: Extract<TEvent, { type: K }>) => void;
}>;

interface UseSseChannelOptions<TEvent extends { type: string }> {
  /** When false, the hook stays mounted without opening a connection. */
  enabled?: boolean;
  /** Called for every event, regardless of type. Fires before `on[type]`. */
  onMessage?: (event: TEvent) => void;
  /** Called when EventSource reports a connection error or reconnect attempt. */
  onError?: (event: Event) => void;
  /** Per-event-type handlers. Exhaustively type-checked against the channel's event union. */
  on?: SseHandlers<TEvent>;
}

/**
 * Subscribe to a typed channel. The URL is the descriptor's API-relative path
 * against the API origin; `on` dispatches by `event.type` with full type
 * narrowing per variant.
 */
export function useSseChannel<C extends AnyChannel>(
  channel: C,
  params: UrlParamsArg<C>,
  options: UseSseChannelOptions<ChannelEvent<C>> = {},
): SseConnectionStatus {
  type TEvent = ChannelEvent<C>;
  const url =
    options.enabled === false
      ? null
      : `${API_BASE_URL}${channel.path(params as ChannelUrlParams<C>)}`;

  return useEventSource<TEvent>(url, {
    enabled: options.enabled,
    onMessage: (event) => {
      options.onMessage?.(event);
      const handler = options.on?.[event.type as TEvent["type"]] as (e: TEvent) => void;
      handler?.(event);
    },
    onError: options.onError,
  });
}
