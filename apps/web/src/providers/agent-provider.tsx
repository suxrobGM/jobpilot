"use client";

import {
  createContext,
  type PropsWithChildren,
  type ReactElement,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { useMediaQuery } from "@mui/material";
import {
  getStoredExpanded,
  getStoredProvider,
  patchAgentStorage,
  subscribeAgentStorage,
} from "@/lib/agent-storage";
import {
  formatSkillCommand,
  injectCommand,
  killSession,
  shutdownHost,
  TerminalApiError,
  type TerminalProviderId,
} from "@/lib/terminal";
import { useToast } from "@/providers/notification-provider";

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
    // The host answers 409 both for "not running" and for a provider mismatch.
    if (error.status === 409 && /provider/i.test(error.message)) {
      return "A different provider is running in the terminal. Switch provider in the dock or restart it.";
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
    try {
      await shutdownHost();
    } catch (error) {
      // Older host without /shutdown - fall back to closing just the session.
      if (error instanceof TerminalApiError && error.status === 404) {
        try {
          await killSession();
        } catch {
          // unreachable or already stopped - the toast below still explains the situation
        }
        toast.error(
          "This agent doesn't support fully stopping yet. Closed the session - update the agent to also close the terminal app.",
        );
        return;
      }
      toast.error(
        error instanceof TerminalApiError
          ? `Couldn't stop the terminal: ${error.message}`
          : "The JobPilot agent isn't reachable, so there is nothing to stop.",
      );
    }
  };

  // Kill the host session and bump the revision so the TerminalPanel key changes,
  // remounting it with a fresh xterm + a newly started session. A failed kill still
  // remounts - the fresh panel reports the host problem in place.
  const restart = async (): Promise<void> => {
    try {
      await killSession();
    } catch {
      // unreachable or already stopped
    }
    setTerminalRevision((n) => n + 1);
  };

  const switchProvider = async (next: TerminalProviderId): Promise<void> => {
    if (next === provider) {
      return;
    }

    try {
      await killSession();
    } catch {
      // unreachable or already stopped - starting the next provider replaces the session anyway
    }
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
