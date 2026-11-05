"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import {
  pilotStart,
  pilotStop,
  TerminalApiError,
  type TerminalProviderId,
} from "@/lib/terminal/client";
import { useAgentDock } from "@/providers/agent-provider";
import { useToast } from "@/providers/toast-provider";

export interface PilotControls {
  provider: TerminalProviderId;
  isLoading: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

function describeHostError(error: unknown): string {
  // The host call runs against the user's own machine, so a network failure means it's offline.
  if (error instanceof TypeError) {
    return "Terminal host offline - install or start the JobPilot agent first, then try again.";
  }
  // Only an agent too old to have the /pilot/start|stop routes answers 404.
  if (error instanceof TerminalApiError && error.status === 404) {
    return "Update the JobPilot agent, then try again.";
  }
  if (error instanceof TerminalApiError) {
    return `The terminal host rejected the request: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/** Start: terminal token, then local host pairing, then API state. Stop runs it in reverse. */
export function usePilotControls(): PilotControls {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const { provider } = useAgentDock();

  const refreshState = (): void => {
    queryClient.invalidateQueries({ queryKey: pilotQueries.state().queryKey });
  };

  const start = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const { data, error } = await api.auth.tokens.terminal.post();
      if (error || !data) {
        toast.error("Couldn't authenticate the agent - sign in to JobPilot and try again.");
        return;
      }
      await pilotStart({
        provider,
        apiToken: data.token,
        apiUrl: API_BASE_URL,
        webUrl: window.location.origin,
      });
      const started = await api.pilot.start.post();
      if (started.error) {
        toast.error("Paired the host, but the API rejected starting the pilot.");
        return;
      }
      refreshState();
      toast.success("Pilot started.");
    } catch (error) {
      toast.error(describeHostError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const stop = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const { error } = await api.pilot.stop.post();
      if (error) {
        toast.error("Couldn't stop the pilot on the API.");
        return;
      }
      try {
        await pilotStop();
        refreshState();
        toast.success("Pilot stopped.");
      } catch (error) {
        // API is already off; a missing host just means nothing is driving the loop.
        refreshState();
        toast.warning(`Pilot stopped on the server. ${describeHostError(error)}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return { provider, isLoading, start, stop };
}
