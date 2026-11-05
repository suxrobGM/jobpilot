"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ExternalStore } from "@/lib/external-store";
import { patchAgentStorage, readAgentStorage } from "@/lib/terminal/agent-storage";
import { getTerminalHostStatus, type SessionStatus } from "@/lib/terminal/client";

export type TerminalHealth =
  | "checking"
  | "reachable"
  | "degraded"
  | "offline"
  | "uninstalled"
  | "blocked";

export const BROWSER_BLOCKED_MESSAGE =
  "Your browser is blocking this site from reaching the agent on your machine. Click the site icon left of the address bar, set Local network access to Allow, then recheck.";

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

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

// One poller for the whole page: the agent drawer, pilot views and onboarding all read this store.
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
    // Persisted so the agent drawer's auto-open and the Start-agent gate survive reloads.
    const stored = readAgentStorage();
    if (!stored?.everReachable || stored.canRelaunch !== status.canRelaunch) {
      patchAgentStorage({ everReachable: true, canRelaunch: status.canRelaunch });
    }
  } catch {
    consecutiveFailures++;
    const previous = store.get();
    // A single dropped probe must not unmount a healthy terminal.
    if (previous.health !== "reachable" || consecutiveFailures >= OFFLINE_CONFIRM_PROBES) {
      setSnapshot({ health: await unreachableHealth(), status: previous.status });
    }
  }
  scheduleNextProbe();
}

/** Chrome's Local Network Access gate: a public page needs this permission to reach localhost at all. */
async function isLoopbackBlocked(): Promise<boolean> {
  if (LOOPBACK_HOSTNAMES.has(window.location.hostname)) {
    return false;
  }
  try {
    // Not yet in TypeScript's PermissionName union; browsers without it throw.
    const name = "loopback-network" as PermissionName;
    const permission = await navigator.permissions.query({ name });
    return permission.state !== "granted";
  } catch {
    return false;
  }
}

// A blocked request fails before it is sent, exactly like a stopped host.
async function unreachableHealth(): Promise<TerminalHealth> {
  if (await isLoopbackBlocked()) {
    return "blocked";
  }
  return readAgentStorage()?.everReachable ? "offline" : "uninstalled";
}

/** Probes now, outside React, so a button can recheck without subscribing. */
export function recheckTerminalHealth(): void {
  void probe();
}

/** Unreachable reads "blocked", then "offline" if a host ever answered here, else "uninstalled". */
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
