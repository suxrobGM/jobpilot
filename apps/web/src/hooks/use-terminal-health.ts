"use client";

import { useEffect, useSyncExternalStore } from "react";
import { patchAgentStorage, readAgentStorage } from "@/lib/agent-storage";
import { ExternalStore } from "@/lib/external-store";
import { getStatus, type SessionStatus } from "@/lib/terminal";

export type TerminalHealth = "checking" | "reachable" | "degraded" | "offline" | "uninstalled";

const POLL_INTERVAL_MS = 5000;

/** Faster cadence while an expected restart (update / Start agent) is in flight. */
const FAST_POLL_INTERVAL_MS = 1500;

/** Consecutive failed probes required before a reachable host is reported offline. */
const OFFLINE_CONFIRM_PROBES = 2;

interface HealthSnapshot {
  health: TerminalHealth;
  /** Last successful /healthz payload (host version, providers, …); null until first reachable. */
  status: SessionStatus | null;
}

export interface TerminalHealthState extends HealthSnapshot {
  recheck: () => void;
}

const INITIAL: HealthSnapshot = { health: "checking", status: null };

// One poller for the whole page: the dock, pilot views and onboarding all read this store.
let active = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;
let fastRequests = 0;

const store = new ExternalStore<HealthSnapshot>(INITIAL, () => {
  active = true;
  void probe();
  return () => {
    active = false;
    clearTimer();
  };
});

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function schedule(): void {
  clearTimer();
  if (active) {
    timer = setTimeout(probe, fastRequests > 0 ? FAST_POLL_INTERVAL_MS : POLL_INTERVAL_MS);
  }
}

async function probe(): Promise<void> {
  clearTimer();
  try {
    const status = await getStatus();
    failures = 0;
    store.set({ health: status.status === "degraded" ? "degraded" : "reachable", status });
    // Persist that a host answered (the dock only auto-expands before that) and its relaunch
    // capability, so the offline card can gate the Start-agent button across reloads.
    const stored = readAgentStorage();
    if (!stored?.everReachable || stored.canRelaunch !== status.canRelaunch) {
      patchAgentStorage({ everReachable: true, canRelaunch: status.canRelaunch });
    }
  } catch {
    failures++;
    const previous = store.get();
    // A single dropped probe must not unmount a healthy terminal.
    if (previous.health !== "reachable" || failures >= OFFLINE_CONFIRM_PROBES) {
      const health = readAgentStorage()?.everReachable ? "offline" : "uninstalled";
      store.set({ health, status: previous.status });
    }
  }
  schedule();
}

/**
 * The local terminal host's health: "reachable" when /healthz answers, "degraded" when it runs but
 * can't start sessions. Unreachable reads "offline" if a host has ever answered from this browser,
 * else "uninstalled". Pass `expectingReturn` while the host is deliberately restarting to poll faster.
 */
export function useTerminalHealth(expectingReturn = false): TerminalHealthState {
  const snapshot = useSyncExternalStore(store.subscribe, store.get, () => INITIAL);

  useEffect(() => {
    if (!expectingReturn) {
      return;
    }
    fastRequests++;
    schedule();
    return () => {
      fastRequests--;
    };
  }, [expectingReturn]);

  return { ...snapshot, recheck: () => void probe() };
}
