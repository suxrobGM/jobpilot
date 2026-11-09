"use client";

import {
  createContext,
  type PropsWithChildren,
  type ReactElement,
  useContext,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { useIsComputer } from "@/hooks/use-is-computer";
import {
  patchAgentStorage,
  readStoredDrawerOpen,
  readStoredProvider,
  subscribeAgentStorage,
} from "@/lib/terminal/agent-storage";
import {
  killSession,
  shutdownHost,
  TerminalApiError,
  type TerminalProviderId,
} from "@/lib/terminal/client";
import { useToast } from "@/providers/toast-provider";

export type AgentDrawerTab = "steps" | "terminal";

export interface AgentDrawerContextValue {
  provider: TerminalProviderId;
  switchProvider: (next: TerminalProviderId) => Promise<void>;
  restart: () => Promise<void>;
  /** Resolves true when the host is shutting down, false when it stayed up. */
  stop: () => Promise<boolean>;
  terminalRevision: number;
  drawerOpen: boolean;
  drawerTab: AgentDrawerTab;
  setDrawerTab: (tab: AgentDrawerTab) => void;
  /** Opens on the terminal. */
  openDrawer: () => void;
  /** Opens on the running task's steps, which also work away from this computer. */
  watchSteps: () => void;
  closeDrawer: () => void;
}

const AgentDrawerContext = createContext<AgentDrawerContextValue | null>(null);

export function AgentProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const toast = useToast();

  // localStorage is the source of truth; useSyncExternalStore keeps render in
  // sync, SSR-safe and without a hydration effect.
  const provider = useSyncExternalStore(
    subscribeAgentStorage,
    readStoredProvider,
    (): TerminalProviderId => "claude",
  );

  const drawerOpen = useSyncExternalStore(subscribeAgentStorage, readStoredDrawerOpen, () => false);
  const [terminalRevision, setTerminalRevision] = useState(0);
  const [drawerTab, setDrawerTab] = useState<AgentDrawerTab>("terminal");

  // True only when the host goes down; otherwise nothing would ever clear the "Stopping…" card.
  const stop = async (): Promise<boolean> => {
    try {
      await shutdownHost();
      return true;
    } catch (error) {
      toast.error(
        error instanceof TerminalApiError
          ? `Couldn't stop the terminal: ${error.message}`
          : "The JobPilot agent isn't reachable, so there is nothing to stop.",
      );
      return false;
    }
  };

  // A failed kill still remounts: the fresh panel reports the host problem in place.
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

  const drawerValue: AgentDrawerContextValue = {
    provider,
    switchProvider,
    restart,
    stop,
    terminalRevision,
    drawerOpen,
    drawerTab,
    setDrawerTab,
    openDrawer: () => {
      setDrawerTab("terminal");
      patchAgentStorage({ drawerOpen: true });
    },
    watchSteps: () => {
      setDrawerTab("steps");
      patchAgentStorage({ drawerOpen: true });
    },
    closeDrawer: () => patchAgentStorage({ drawerOpen: false }),
  };

  return <AgentDrawerContext.Provider value={drawerValue}>{children}</AgentDrawerContext.Provider>;
}

export function useAgentDrawer(): AgentDrawerContextValue {
  const ctx = useContext(AgentDrawerContext);
  if (!ctx) {
    throw new Error("useAgentDrawer must be used within an AgentProvider");
  }
  return ctx;
}

/** Whether a host holds the API's event stream open, from any device. Null until the state loads. */
export function useAgentConnected(): boolean | null {
  const { data } = useQuery({ ...pilotQueries.state(), select: (state) => state.agentConnected });
  return data ?? null;
}

/** A computer always queues agent work; a phone or tablet needs a host connected to the API. */
export function useAgentAvailable(): boolean {
  const computer = useIsComputer();
  const connected = useAgentConnected();
  return computer || connected === true;
}
