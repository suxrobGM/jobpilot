"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { useSession } from "@/hooks/use-auth";
import { useTerminalHealth } from "@/hooks/use-terminal-health";
import { pairPilot, type TerminalProviderId } from "@/lib/terminal/client";
import { useAgentDrawer } from "@/providers/agent-provider";

async function pair(userId: string, provider: TerminalProviderId): Promise<void> {
  const { data } = await api.auth.tokens.terminal.post();
  if (data) {
    await pairPilot({
      provider,
      apiToken: data.token,
      apiUrl: API_BASE_URL,
      webUrl: window.location.origin,
      userId,
    });
  }
}

/** Pairs a reachable host with the signed-in account, so the pilot runs with no Start button. */
export function PilotPairing(): ReactNode {
  const { health, status } = useTerminalHealth();
  const user = useSession();
  const { provider } = useAgentDrawer();
  // One attempt per account and provider per page load; a host paired elsewhere is re-paired once.
  const attempted = useRef<string | null>(null);

  const pilot = status?.pilot;

  useEffect(() => {
    if (!user || !pilot || health !== "reachable") {
      return;
    }
    const key = `${user.id}:${provider}`;
    if (attempted.current === key) {
      return;
    }
    const pairedHere = pilot.userId === user.id;
    // The first visit to an already-paired host only records it; a provider switch re-pairs.
    const firstLook = attempted.current === null;
    attempted.current = key;
    if (pairedHere && firstLook) {
      return;
    }
    pair(user.id, provider).catch(() => {
      // An unreachable host is retried on the next page load.
      attempted.current = null;
    });
  });

  return null;
}
