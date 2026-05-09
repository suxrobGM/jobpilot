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

interface TerminalContextValue {
  open: boolean;
  provider: TerminalProviderId;
  toggle: () => void;
  setOpen: (open: boolean) => void;
  setProvider: (provider: TerminalProviderId) => void;
  inject: (command: string) => Promise<void>;
  injectSkill: (skill: string, args?: string) => Promise<void>;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

export function TerminalProvider(props: PropsWithChildren): ReactElement {
  const { children } = props;
  const [open, setOpen] = useState(false);
  const [provider, setProviderState] = useState<TerminalProviderId>(getProvider());

  const setProvider = (nextProvider: TerminalProviderId): void => {
    setProviderState(nextProvider);
    window.localStorage.setItem(TERMINAL_PROVIDER_KEY, nextProvider);
  };

  const value: TerminalContextValue = {
    open,
    provider,
    toggle: () => setOpen((prev) => !prev),
    setOpen,
    setProvider,
    inject: async (command: string) => {
      await injectCommand(command, provider);
    },
    injectSkill: async (skill: string, args?: string) => {
      await injectCommand(formatSkillCommand(provider, skill, args), provider);
    },
  };

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal(): TerminalContextValue {
  const ctx = useContext(TerminalContext);
  if (!ctx) {
    throw new Error("useTerminal must be used within a TerminalProvider");
  }
  return ctx;
}
