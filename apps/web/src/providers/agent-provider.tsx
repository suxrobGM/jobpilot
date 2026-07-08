"use client";

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { useMediaQuery } from "@mui/material";
import {
  formatSkillCommand,
  injectCommand,
  killSession,
  TerminalApiError,
  type TerminalProviderId,
} from "@/lib/terminal";
import { useToast } from "@/providers/notification-provider";
import { readLocalStorage, writeLocalStorage } from "@/utils/local-storage";

const STORAGE_KEY = "jobpilot:agent";

interface AgentStorage {
  provider: TerminalProviderId;
  dockWidth: number;
  dockExpanded: boolean;
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

function getStoredProvider(): TerminalProviderId {
  const p = readAgentStorage()?.provider;
  return p === "codex" || p === "claude" ? p : "claude";
}

function getStoredExpanded(): boolean {
  const stored = readAgentStorage();
  // Default expanded until a host has ever connected, so new users see the install card;
  // an explicit collapse (stored dockExpanded) always wins.
  return stored?.dockExpanded ?? !stored?.everReachable;
}

export interface AgentContextValue {
  inject: (command: string) => Promise<void>;
  injectSkill: (skill: string, args?: string) => Promise<void>;
}

export interface AgentDockContextValue {
  provider: TerminalProviderId;
  switchProvider: (next: TerminalProviderId) => Promise<void>;
  restart: () => Promise<void>;
  stop: () => Promise<void>;
  terminalRevision: number;
  expanded: boolean;
  expand: () => void;
  collapse: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);
const AgentDockContext = createContext<AgentDockContextValue | null>(null);

function describeInjectError(error: unknown): string {
  if (error instanceof TypeError) {
    return "The JobPilot agent isn't reachable. Open the agent dock to install and start it, then try again.";
  }

  if (error instanceof TerminalApiError) {
    if (error.status === 404) {
      return "Terminal session has ended. Restart it from the Terminal tab in the dock.";
    }
    if (error.status === 409 || error.status === 500) {
      return "No active terminal session. Open the Terminal tab in the dock and start one.";
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return `Failed to send command to terminal: ${message}`;
}

export function AgentProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const toast = useToast();

  // localStorage is the source of truth; useSyncExternalStore keeps render in
  // sync, SSR-safe and without a hydration effect.
  const provider = useSyncExternalStore(
    subscribeAgentStorage,
    getStoredProvider,
    (): TerminalProviderId => "claude",
  );

  const expanded = useSyncExternalStore(subscribeAgentStorage, getStoredExpanded, () => false);
  const [terminalRevision, setTerminalRevision] = useState(0);

  const stop = async (): Promise<void> => {
    await killSession();
  };

  // Kill the host session and bump the revision so the TerminalPanel key changes,
  // remounting it with a fresh xterm + a newly started session.
  const restart = async (): Promise<void> => {
    await killSession();
    setTerminalRevision((n) => n + 1);
  };

  const switchProvider = async (next: TerminalProviderId): Promise<void> => {
    if (next === provider) {
      return;
    }

    await killSession();
    patchAgentStorage({ provider: next });
    setTerminalRevision((n) => n + 1);
  };

  const runInject = async (command: string): Promise<void> => {
    patchAgentStorage({ dockExpanded: true });
    try {
      await injectCommand(command, provider);
    } catch (error) {
      toast.error(describeInjectError(error));
    }
  };

  const publicValue: AgentContextValue = {
    inject: (command) => runInject(command),
    injectSkill: (skill, args) => runInject(formatSkillCommand(provider, skill, args)),
  };

  const dockValue: AgentDockContextValue = {
    provider,
    switchProvider,
    restart,
    stop,
    terminalRevision,
    expanded,
    expand: () => patchAgentStorage({ dockExpanded: true }),
    collapse: () => patchAgentStorage({ dockExpanded: false }),
  };

  return (
    <AgentContext.Provider value={publicValue}>
      <AgentDockContext.Provider value={dockValue}>{children}</AgentDockContext.Provider>
    </AgentContext.Provider>
  );
}

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return ctx;
}

export function useAgentDock(): AgentDockContextValue {
  const ctx = useContext(AgentDockContext);
  if (!ctx) {
    throw new Error("useAgentDock must be used within an AgentProvider");
  }
  return ctx;
}

/**
 * True only on desktop, where the local agent terminal runs. Below md there is
 * no dock to inject into, so agent-driving controls hide themselves against this.
 */
export function useAgentAvailable(): boolean {
  return useMediaQuery((theme) => theme.breakpoints.up("md"));
}
