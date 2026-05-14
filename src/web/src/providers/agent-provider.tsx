"use client";

import {
  createContext,
  useContext,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import { formatSkillCommand, injectCommand, type TerminalProviderId } from "@/lib/terminal";

const TERMINAL_PROVIDER_KEY = "jobpilot.terminal.provider";

function getProvider(): TerminalProviderId {
  if (typeof window === "undefined") return "claude";
  return window.localStorage.getItem(TERMINAL_PROVIDER_KEY) === "codex" ? "codex" : "claude";
}

export type AgentTab = "pilot" | "terminal" | "events";

export type AgentStatus = "idle" | "working" | "awaiting-input" | "error";

export interface AgentFocus {
  runId: string;
  jobKey: string;
  step: string;
  message: string;
}

export interface AgentContextValue {
  expanded: boolean;
  activeTab: AgentTab;
  setActiveTab: (tab: AgentTab) => void;
  expand: (tab?: AgentTab) => void;
  collapse: () => void;
  toggleExpanded: () => void;

  status: AgentStatus;
  currentFocus: AgentFocus | null;

  provider: TerminalProviderId;
  setProvider: (provider: TerminalProviderId) => void;

  inject: (command: string) => Promise<void>;
  injectSkill: (skill: string, args?: string) => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<AgentTab>("pilot");
  const [provider, setProviderState] = useState<TerminalProviderId>(getProvider());
  const [status] = useState<AgentStatus>("idle");
  const [currentFocus] = useState<AgentFocus | null>(null);

  const setProvider = (next: TerminalProviderId): void => {
    setProviderState(next);
    window.localStorage.setItem(TERMINAL_PROVIDER_KEY, next);
  };

  const expand = (tab?: AgentTab): void => {
    if (tab) setActiveTab(tab);
    setExpanded(true);
  };

  const value: AgentContextValue = {
    expanded,
    activeTab,
    setActiveTab,
    expand,
    collapse: () => setExpanded(false),
    toggleExpanded: () => setExpanded((prev) => !prev),
    status,
    currentFocus,
    provider,
    setProvider,
    inject: (command: string) => injectCommand(command, provider),
    injectSkill: (skill: string, args?: string) =>
      injectCommand(formatSkillCommand(provider, skill, args), provider),
  };

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return ctx;
}
