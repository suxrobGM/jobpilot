"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ExternalStore } from "@/lib/external-store";
import { patchAgentStorage, readAgentStorage } from "@/lib/terminal/agent-storage";
import { getTerminalHostStatus, type SessionStatus } from "@/lib/terminal/client";

export type TerminalHealth = "checking" | "reachable" | "degraded" | "offline" | "uninstalled";

const POLL_INTERVAL_MS = 5000;

/** Faster cadence while an expected restart (update / Start agent) is in flight. */
const FAST_POLL_INTERVAL_MS = 1500;

/** Consecutive failed probes required before a reachable host is reported offline. */
const OFFLINE_CONFIRM_PROBES = 2;

export interface TerminalHealthState {
  health: TerminalHealth;
  /** Last successful /healthz payload (host version, providers, …); null until first reachable. */
  status: SessionStatus | null;
}

const INITIAL: TerminalHealthState = { health: "checking", status: null };

// One poller for the whole page: the dock, pilot views and onboarding all read this store.
let isPolling = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let fastPollRequests = 0;

const store = new ExternalStore<TerminalHealthState>(INITIAL, () => {
  isPolling = true;
  void probe();
  return () => {
    isPolling = false;
    clearTimer();
  };
});

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

// Skips unchanged probes, which would otherwise re-render every subscriber on each poll.
function setSnapshot(next: TerminalHealthState): void {
  const previous = store.get();
  if (
    previous.health !== next.health ||
    JSON.stringify(previous.status) !== JSON.stringify(next.status)
  ) {
    store.set(next);
  }
}

function scheduleNextProbe(): void {
  clearTimer();
  if (isPolling) {
    timer = setTimeout(probe, fastPollRequests > 0 ? FAST_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
  }
}

async function probe(): Promise<void> {
  clearTimer();
  try {
    const status = await getTerminalHostStatus();
    consecutiveFailures = 0;
    setSnapshot({ health: status.status === "degraded" ? "degraded" : "reachable", status });
    // Persisted so the dock's auto-expand and the Start-agent gate survive reloads.
    const stored = readAgentStorage();
    if (!stored?.everReachable || stored.canRelaunch !== status.canRelaunch) {
      patchAgentStorage({ everReachable: true, canRelaunch: status.canRelaunch });
    }
  } catch {
    consecutiveFailures++;
    const previous = store.get();
    // A single dropped probe must not unmount a healthy terminal.
    if (previous.health !== "reachable" || consecutiveFailures >= OFFLINE_CONFIRM_PROBES) {
      const health = readAgentStorage()?.everReachable ? "offline" : "uninstalled";
      setSnapshot({ health, status: previous.status });
    }
  }
  scheduleNextProbe();
}

/** Probes now, outside React, so a button can recheck without subscribing. */
export function recheckTerminalHealth(): void {
  void probe();
}

/** Unreachable reads "offline" once a host has ever answered from this browser, else "uninstalled". */
export function useTerminalHealth(expectingReturn = false): TerminalHealthState {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, () => INITIAL);

  useEffect(() => {
    if (!expectingReturn) {
      return;
    }
    fastPollRequests++;
    scheduleNextProbe();
    return () => {
      fastPollRequests--;
    };
  }, [expectingReturn]);

  return snapshot;
}
