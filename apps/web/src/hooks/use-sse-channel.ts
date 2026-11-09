"use client";

import type {
  AnyChannel,
  ChannelEvent,
  ChannelUrlParams,
  Jsonified,
} from "@jobpilot/contracts/sse";
import { EventSource } from "eventsource";
import { useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@/api/base-url";

/** "idle" = no connection requested; "reconnecting" = auto-retry or our backoff re-dial after a fatal close. */
export type SseConnectionStatus = "idle" | "connecting" | "open" | "reconnecting";

/** Paramless channels (`TUrlParams = void`) take an explicit `null`; typed ones their full params. */
export type UrlParamsArg<C extends AnyChannel> =
  // biome-ignore lint/suspicious/noConfusingVoidType: probes the `TUrlParams = void` channels declare
  void extends ChannelUrlParams<C> ? null : ChannelUrlParams<C>;

interface SharedSource {
  source: EventSource;
  status: SseConnectionStatus;
  onMessage: Set<(event: MessageEvent<string>) => void>;
  onStatus: Set<(status: SseConnectionStatus) => void>;
  /** Pending re-dial after a fatal close; cleared when the last subscriber leaves. */
  redialTimer: ReturnType<typeof setTimeout> | null;
  redialDelayMs: number;
}

const sharedSources = new Map<string, SharedSource>();

const REDIAL_BASE_MS = 2_000;
const REDIAL_MAX_MS = 30_000;

function setEntryStatus(entry: SharedSource, status: SseConnectionStatus): void {
  if (entry.status === status) {
    return;
  }
  entry.status = status;
  for (const listener of entry.onStatus) {
    listener(status);
  }
}

/** `eventsource` (not native) for fetch-based transport: credentialed cross-origin streams + header control. */
function openSource(url: string): EventSource {
  return new EventSource(url, { withCredentials: true });
}

function dial(url: string, entry: SharedSource, source: EventSource): void {
  entry.source = source;
  // A listener may remove itself during dispatch; Sets tolerate deletion while iterating.
  source.onmessage = (event) => {
    for (const listener of entry.onMessage) {
      listener(event);
    }
  };
  source.onopen = () => {
    entry.redialDelayMs = REDIAL_BASE_MS;
    setEntryStatus(entry, "open");
  };
  source.onerror = () => {
    // A superseded source's late error must not clobber the live one's status.
    if (entry.source !== source) {
      return;
    }
    setEntryStatus(entry, "reconnecting");
    // The package retries only network drops; without a re-dial, one bad gateway during a deploy
    // kills live updates until a hard reload.
    if (source.readyState === source.CLOSED && entry.redialTimer === null) {
      entry.redialTimer = setTimeout(() => {
        entry.redialTimer = null;
        entry.redialDelayMs = Math.min(entry.redialDelayMs * 2, REDIAL_MAX_MS);
        dial(url, entry, openSource(url));
      }, entry.redialDelayMs);
    }
  };
}

/** Refcounted per URL, so a page with several panels holds one connection. */
function acquireSource(
  url: string,
  onMessage: (event: MessageEvent<string>) => void,
  onStatus: (status: SseConnectionStatus) => void,
): () => void {
  let shared = sharedSources.get(url);

  if (!shared) {
    const entry: SharedSource = {
      source: openSource(url),
      status: "connecting",
      onMessage: new Set(),
      onStatus: new Set(),
      redialTimer: null,
      redialDelayMs: REDIAL_BASE_MS,
    };
    shared = entry;
    sharedSources.set(url, entry);
    dial(url, entry, entry.source);
  }

  shared.onMessage.add(onMessage);
  shared.onStatus.add(onStatus);
  // Replay the current status so late subscribers don't sit on a stale "idle".
  onStatus(shared.status);

  return () => {
    shared.onMessage.delete(onMessage);
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

export type SseHandlers<TEvent extends { type: string }> = Partial<{
  [K in TEvent["type"]]: (event: Extract<TEvent, { type: K }>) => void;
}>;

interface UseSseChannelOptions<TEvent extends { type: string }> {
  /** When false, the hook stays mounted without opening a connection. */
  enabled?: boolean;
  on?: SseHandlers<TEvent>;
}

export function useSseChannel<C extends AnyChannel>(
  channel: C,
  params: UrlParamsArg<C>,
  options: UseSseChannelOptions<Jsonified<ChannelEvent<C>>> = {},
): SseConnectionStatus {
  // Events arrive as parsed JSON: no Date revival, unlike Eden responses.
  type TEvent = Jsonified<ChannelEvent<C>>;
  const { enabled = true } = options;
  const url = enabled ? `${API_BASE_URL}${channel.path(params as ChannelUrlParams<C>)}` : null;
  const [status, setStatus] = useState<SseConnectionStatus>("idle");

  // Handlers change every render; the connection must not, so it reads them through a ref.
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(() => {
    if (!url) {
      setStatus("idle");
      return;
    }
    const onMessage = (raw: MessageEvent<string>): void => {
      let event: TEvent;
      try {
        event = JSON.parse(raw.data) as TEvent;
      } catch {
        return;
      }
      const handler = optionsRef.current.on?.[event.type as TEvent["type"]] as
        | ((e: TEvent) => void)
        | undefined;
      handler?.(event);
    };
    return acquireSource(url, onMessage, setStatus);
  }, [url]);

  return status;
}
