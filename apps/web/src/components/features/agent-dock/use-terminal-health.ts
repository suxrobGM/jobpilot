"use client";

import { useEffect, useState } from "react";
import { getStatus, type SessionStatus } from "@/lib/terminal";
import { patchAgentStorage, readAgentStorage } from "@/providers/agent-provider";

export type TerminalHealth = "checking" | "reachable" | "degraded" | "offline" | "uninstalled";

const POLL_INTERVAL_MS = 5000;

export interface TerminalHealthState {
  health: TerminalHealth;
  /** Last successful /healthz payload (host version, providers, …); null until first reachable. */
  status: SessionStatus | null;
  recheck: () => void;
}

/**
 * Polls the local terminal host; "reachable" when /healthz answers, "degraded" when the host
 * runs but can't start sessions (broken install). When unreachable, "offline" if a host has ever
 * answered from this browser (installed, just stopped) else "uninstalled" (never connected).
 */
export function useTerminalHealth(): TerminalHealthState {
  const [health, setHealth] = useState<TerminalHealth>("checking");
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const probe = async (): Promise<void> => {
      try {
        const result = await getStatus();
        if (active) {
          setStatus(result);
          setHealth(result.status === "degraded" ? "degraded" : "reachable");
          // Persist that a host answered (the dock only auto-expands before that) and its relaunch
          // capability, so the offline card can gate the Start-agent button across reloads.
          const stored = readAgentStorage();
          if (!stored?.everReachable || stored.canRelaunch !== result.canRelaunch) {
            patchAgentStorage({ everReachable: true, canRelaunch: result.canRelaunch });
          }
        }
      } catch {
        if (active) {
          setHealth(readAgentStorage()?.everReachable ? "offline" : "uninstalled");
        }
      }
      if (active) {
        timer = setTimeout(probe, POLL_INTERVAL_MS);
      }
    };

    void probe();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [nonce]);

  return { health, status, recheck: () => setNonce((n) => n + 1) };
}
