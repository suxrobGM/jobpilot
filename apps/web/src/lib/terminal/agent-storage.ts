"use client";

import type { TerminalProviderId } from "@/lib/terminal/client";
import { readLocalStorage, writeLocalStorage } from "@/utils/local-storage";

const STORAGE_KEY = "jobpilot:agent";

interface AgentStorage {
  provider: TerminalProviderId;
  drawerWidth: number;
  drawerOpen: boolean;
  /** True once a local terminal host has ever answered /healthz from this browser. */
  everReachable: boolean;
  /** Last-reported host capability: the jobpilot:// scheme is registered, so it can be relaunched from the browser. */
  canRelaunch: boolean;
}

const storageListeners = new Set<() => void>();

function emitAgentStorageChange(): void {
  for (const listener of storageListeners) {
    listener();
  }
}

let crossTabListenerAttached = false;
function ensureCrossTabListener(): void {
  if (crossTabListenerAttached || typeof window === "undefined") {
    return;
  }
  crossTabListenerAttached = true;
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      emitAgentStorageChange();
    }
  });
}

export function patchAgentStorage(patch: Partial<AgentStorage>): void {
  const current = readLocalStorage<Partial<AgentStorage>>(STORAGE_KEY) ?? {};
  writeLocalStorage(STORAGE_KEY, { ...current, ...patch });
  emitAgentStorageChange();
}

export function readAgentStorage(): Partial<AgentStorage> | null {
  return readLocalStorage<Partial<AgentStorage>>(STORAGE_KEY);
}

/** Subscribe to agent-storage changes - same-tab patches and cross-tab writes. */
export function subscribeAgentStorage(listener: () => void): () => void {
  ensureCrossTabListener();
  storageListeners.add(listener);
  return () => {
    storageListeners.delete(listener);
  };
}

export function readStoredProvider(): TerminalProviderId {
  const provider = readAgentStorage()?.provider;
  return provider === "codex" || provider === "claude" ? provider : "claude";
}

export function readStoredDrawerOpen(): boolean {
  const stored = readAgentStorage();
  // Open until a host has connected, so new users see install; a stored close wins.
  return stored?.drawerOpen ?? !stored?.everReachable;
}
