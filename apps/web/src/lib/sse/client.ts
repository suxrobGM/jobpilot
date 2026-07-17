"use client";

import type { AnyChannel, ChannelEvent, ChannelUrlParams } from "@jobpilot/contracts/sse";
import { EventSource } from "eventsource";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/base-url";

/** "idle" = no connection requested; "reconnecting" = auto-retry or our backoff re-dial after a fatal close. */
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
  /** Pending re-dial after a fatal close; cleared when the last subscriber leaves. */
  redialTimer: ReturnType<typeof setTimeout> | null;
  redialDelayMs: number;
}

const sharedSources = new Map<string, SharedSource>();

const REDIAL_BASE_MS = 2_000;
const REDIAL_MAX_MS = 30_000;

function setEntryStatus(entry: SharedSource, status: SseConnectionStatus): void {
  if (entry.status === status) return;
  entry.status = status;
  for (const listener of entry.onStatus) listener(status);
}

/** `eventsource` (not native) for fetch-based transport: credentialed cross-origin streams + header control. */
function openSource(url: string): EventSource {
  return new EventSource(url, { withCredentials: true });
}

/** Wire a freshly opened source into the shared entry; the initial connect and every re-dial go through here. */
function dial(url: string, entry: SharedSource, source: EventSource): void {
  entry.source = source;
  // A listener may remove itself during dispatch; Sets tolerate deletion while iterating.
  source.onmessage = (event) => {
    for (const listener of entry.onMessage) listener(event);
  };
  source.onopen = () => {
    entry.redialDelayMs = REDIAL_BASE_MS;
    setEntryStatus(entry, "open");
  };
  source.onerror = (event) => {
    // A superseded source's late error must not clobber the live one's status.
    if (entry.source !== source) return;
    setEntryStatus(entry, "reconnecting");
    // The package auto-retries only network drops; any non-200 response is a fatal
    // close (readyState CLOSED), so re-dial with capped backoff or one bad gateway
    // response during a deploy would kill live updates until a hard reload.
    if (source.readyState === source.CLOSED && entry.redialTimer === null) {
      entry.redialTimer = setTimeout(() => {
        entry.redialTimer = null;
        entry.redialDelayMs = Math.min(entry.redialDelayMs * 2, REDIAL_MAX_MS);
        dial(url, entry, openSource(url));
      }, entry.redialDelayMs);
    }
    for (const listener of entry.onError) listener(event);
  };
}

/** Refcount one EventSource per URL so a page with several panels holds one connection, not one per subscriber. */
function acquireSource(
  url: string,
  onMessage: (event: MessageEvent<string>) => void,
  onError: (event: Event) => void,
  onStatus: (status: SseConnectionStatus) => void,
): () => void {
  let shared = sharedSources.get(url);

  if (!shared) {
    const entry: SharedSource = {
      source: openSource(url),
      status: "connecting",
      onMessage: new Set(),
      onError: new Set(),
      onStatus: new Set(),
      redialTimer: null,
      redialDelayMs: REDIAL_BASE_MS,
    };
    shared = entry;
    sharedSources.set(url, entry);
    dial(url, entry, entry.source);
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
      if (shared.redialTimer !== null) {
        clearTimeout(shared.redialTimer);
        shared.redialTimer = null;
      }
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
  });
}
