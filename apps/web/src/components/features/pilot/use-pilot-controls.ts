"use client";

import type { PilotState } from "@jobpilot/contracts/pilot";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { queryKeys } from "@/api/query-keys";
import { pilotStart, pilotStop, TerminalApiError, type TerminalProviderId } from "@/lib/terminal";
import { useAgentDock } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";

export interface PilotControls {
  provider: TerminalProviderId;
  /** True while a start/stop round-trip is in flight. */
  busy: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

function describeHostError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Terminal host offline - install or start the JobPilot agent first, then try again.";
  }
  // A host without the /pilot/start|stop routes is an old agent: point the user at the update.
  if (error instanceof TerminalApiError && error.status === 404) {
    return "Update the JobPilot agent, then try again.";
  }
  if (error instanceof TerminalApiError) {
    return `The terminal host rejected the request: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

/**
 * Wires the three-step start flow (terminal token → local host pairing → API
 * state) and its reverse. The host call runs against the user's local machine,
 * so a TypeError means the host is offline rather than an API failure.
 */
export function usePilotControls(): PilotControls {
  const toast = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { provider } = useAgentDock();

  const refreshState = (): void => {
    queryClient.invalidateQueries({ queryKey: queryKeys.pilot.state() });
  };

  const start = async (): Promise<void> => {
    // Goals are mandatory: skip the token/pairing round-trip and point the user at Goals instead.
    const cached = queryClient.getQueryData<PilotState>(queryKeys.pilot.state());
    if ((cached?.instructionsGoals ?? "").trim() === "") {
      toast.error("Write the pilot's goals before starting it.");
      router.push("/pilot/instructions");
      return;
    }
    setBusy(true);
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
      setBusy(false);
    }
  };

  const stop = async (): Promise<void> => {
    setBusy(true);
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
      setBusy(false);
    }
  };

  return { provider, busy, start, stop };
}
