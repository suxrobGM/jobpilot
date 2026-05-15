"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
  type ReactElement,
} from "react";
import {
  DOCK_EXPANDED,
  DOCK_MAX_EXPANDED,
  DOCK_MIN_EXPANDED,
} from "@/components/layout/shell-config";
import { formatSkillCommand, injectCommand, type TerminalProviderId } from "@/lib/terminal";

const TERMINAL_PROVIDER_KEY = "jobpilot.terminal.provider";
const DOCK_WIDTH_KEY = "jobpilot.dock.width";

function getProvider(): TerminalProviderId {
  if (typeof window === "undefined") return "claude";
  return window.localStorage.getItem(TERMINAL_PROVIDER_KEY) === "codex" ? "codex" : "claude";
}

function clampWidth(value: number): number {
  return Math.max(DOCK_MIN_EXPANDED, Math.min(DOCK_MAX_EXPANDED, Math.round(value)));
}

export type AgentTab = "terminal" | "events";

export interface AgentContextValue {
  expanded: boolean;
  activeTab: AgentTab;
  setActiveTab: (tab: AgentTab) => void;
  expand: (tab?: AgentTab) => void;
  collapse: () => void;
  toggleExpanded: () => void;

  expandedWidth: number;
  setExpandedWidth: (px: number) => void;

  provider: TerminalProviderId;
  setProvider: (provider: TerminalProviderId) => void;

  inject: (command: string) => Promise<void>;
  injectSkill: (skill: string, args?: string) => Promise<void>;
}

const AgentContext = createContext<AgentContextValue | null>(null);

export function AgentProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<AgentTab>("terminal");
  const [provider, setProviderState] = useState<TerminalProviderId>(getProvider());
  const [expandedWidth, setExpandedWidthState] = useState<number>(DOCK_EXPANDED);

  useEffect(() => {
    const stored = window.localStorage.getItem(DOCK_WIDTH_KEY);
    if (!stored) {
      return;
    }

    const parsed = Number(stored);
    if (!Number.isFinite(parsed)) {
      return;
    }
    setExpandedWidthState(clampWidth(parsed));
  }, []);

  const setProvider = (next: TerminalProviderId): void => {
    setProviderState(next);
    window.localStorage.setItem(TERMINAL_PROVIDER_KEY, next);
  };

  const setExpandedWidth = (px: number): void => {
    const next = clampWidth(px);
    setExpandedWidthState(next);
    window.localStorage.setItem(DOCK_WIDTH_KEY, String(next));
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
    expandedWidth,
    setExpandedWidth,
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
