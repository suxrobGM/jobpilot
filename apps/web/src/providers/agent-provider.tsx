"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
  type ReactElement,
} from "react";
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
const READY_TIMEOUT_MS = 15_000;

interface AgentStorage {
  provider: TerminalProviderId;
  dockWidth: number;
  dockExpanded: boolean;
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

/** Subscribe to agent-storage changes — same-tab patches and cross-tab writes. */
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
  return readAgentStorage()?.dockExpanded ?? false;
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
  markTerminalReady: () => void;
  resetTerminalReady: () => void;
}

const AgentContext = createContext<AgentContextValue | null>(null);
const AgentDockContext = createContext<AgentDockContextValue | null>(null);

class TerminalReadyTimeoutError extends Error {
  constructor() {
    super("Terminal did not become ready in time.");
    this.name = "TerminalReadyTimeoutError";
  }
}

function describeInjectError(error: unknown): string {
  if (error instanceof TypeError) {
    return "JobPilot Terminal isn't reachable. Start it (bun run dev) and open the Terminal tab in the dock.";
  }
  if (error instanceof TerminalReadyTimeoutError) {
    return "Terminal didn't finish starting up. Try again in a moment or restart the Terminal.";
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

  const terminalReadyRef = useRef(false);
  const readyWaitersRef = useRef<Array<() => void>>([]);

  const markTerminalReady = (): void => {
    if (terminalReadyRef.current) {
      return;
    }
    terminalReadyRef.current = true;
    const waiters = readyWaitersRef.current;
    readyWaitersRef.current = [];
    waiters.forEach((resolve) => resolve());
  };

  const resetTerminalReady = (): void => {
    terminalReadyRef.current = false;
  };

  const waitForTerminalReady = (timeoutMs: number): Promise<void> =>
    new Promise((resolve, reject) => {
      if (terminalReadyRef.current) {
        return resolve();
      }
      const wrappedResolve = (): void => {
        clearTimeout(timerId);
        resolve();
      };

      const timerId = setTimeout(() => {
        readyWaitersRef.current = readyWaitersRef.current.filter((r) => r !== wrappedResolve);
        reject(new TerminalReadyTimeoutError());
      }, timeoutMs);

      readyWaitersRef.current.push(wrappedResolve);
    });

  const restart = async (): Promise<void> => {
    resetTerminalReady();
    await killSession();
    setTerminalRevision((n) => n + 1);
  };

  const stop = async (): Promise<void> => {
    resetTerminalReady();
    await killSession();
  };

  const switchProvider = async (next: TerminalProviderId): Promise<void> => {
    if (next === provider) {
      return;
    }
    resetTerminalReady();
    await killSession();
    patchAgentStorage({ provider: next });
    setTerminalRevision((n) => n + 1);
  };

  const runInject = async (command: string): Promise<void> => {
    patchAgentStorage({ dockExpanded: true });
    try {
      await waitForTerminalReady(READY_TIMEOUT_MS);
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
    markTerminalReady,
    resetTerminalReady,
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
