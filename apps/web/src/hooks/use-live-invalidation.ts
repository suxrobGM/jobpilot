"use client";

import type { AnyChannel, ChannelEvent, Jsonified } from "@jobpilot/contracts/sse";
import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  type SseConnectionStatus,
  type SseHandlers,
  type UrlParamsArg,
  useSseChannel,
} from "./use-sse-channel";

/** The queries an event makes stale, or a handler for anything richer (a direct cache write). */
type LiveHandler<TEvent> = readonly QueryKey[] | ((event: TEvent) => void);

type LiveHandlers<TEvent extends { type: string }> = Partial<{
  [K in TEvent["type"]]: LiveHandler<Extract<TEvent, { type: K }>>;
}>;

interface UseLiveInvalidationOptions<TEvent extends { type: string }> {
  on: LiveHandlers<TEvent>;
  /** Runs once a dropped stream reconnects, to catch up on the events it missed. */
  onReconnect?: LiveHandler<void>;
  enabled?: boolean;
}

/** Keeps the query cache in step with a live channel. */
export function useLiveInvalidation<C extends AnyChannel>(
  channel: C,
  params: UrlParamsArg<C>,
  options: UseLiveInvalidationOptions<Jsonified<ChannelEvent<C>>>,
): SseConnectionStatus {
  const { on, onReconnect, enabled } = options;
  const queryClient = useQueryClient();

  const invalidate = (keys: readonly QueryKey[]): void => {
    for (const queryKey of keys) {
      void queryClient.invalidateQueries({ queryKey });
    }
  };

  type TEvent = Jsonified<ChannelEvent<C>>;
  const handlers: Record<string, (event: TEvent) => void> = {};
  for (const [type, handler] of Object.entries(on) as [string, LiveHandler<TEvent>][]) {
    handlers[type] = typeof handler === "function" ? handler : () => invalidate(handler);
  }
  const status = useSseChannel(channel, params, {
    enabled,
    on: handlers as SseHandlers<TEvent>,
  });

  const previous = useRef(status);
  useEffect(() => {
    if (previous.current === "reconnecting" && status === "open" && onReconnect) {
      if (typeof onReconnect === "function") {
        onReconnect();
      } else {
        invalidate(onReconnect);
      }
    }
    previous.current = status;
  });

  return status;
}
