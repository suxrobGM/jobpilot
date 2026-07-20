"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import {
  pilotDisable,
  pilotEnable,
  TerminalApiError,
  type TerminalProviderId,
} from "@/lib/terminal";
import { useAgentDock } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";

export interface PilotToggle {
  provider: TerminalProviderId;
  /** True while an enable/disable round-trip is in flight. */
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

function describeHostError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Terminal host offline - install or start the JobPilot agent first, then try again.";
  }
  if (error instanceof TerminalApiError) {
    return `The terminal host rejected the request: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Wires the three-step enable flow (terminal token → local host pairing → API
 * state) and its reverse. The host call runs against the user's local machine,
 * so a TypeError means the host is offline rather than an API failure.
 */
export function usePilotToggle(): PilotToggle {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { provider } = useAgentDock();

  const refreshState = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pilot.state() });
  };

  const enable = async (): Promise<void> => {
    setBusy(true);
    try {
      const { data, error } = await api.auth.tokens.terminal.post();
      if (error || !data) {
        toast.error("Couldn't authenticate the agent - sign in to JobPilot and try again.");
        return;
      }
      await pilotEnable({
        provider,
        apiToken: data.token,
        apiUrl: API_BASE_URL,
        webUrl: window.location.origin,
      });
      const enabled = await api.pilot.enabled.post({ enabled: true });
      if (enabled.error) {
        toast.error("Paired the host, but the API rejected enabling the pilot.");
        return;
      }
      refreshState();
      toast.success("Pilot enabled.");
    } catch (error) {
      toast.error(describeHostError(error));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (): Promise<void> => {
    setBusy(true);
    try {
      const { error } = await api.pilot.enabled.post({ enabled: false });
      if (error) {
        toast.error("Couldn't disable the pilot on the API.");
        return;
      }
      try {
        await pilotDisable();
        refreshState();
        toast.success("Pilot disabled.");
      } catch (error) {
        // API is already off; a missing host just means nothing is driving the loop.
        refreshState();
        toast.warning(`Pilot disabled on the server. ${describeHostError(error)}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return { provider, busy, enable, disable };
}
