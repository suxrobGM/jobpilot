"use client";

import { createContext, type ReactElement, type ReactNode, use } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import type { SessionStatus } from "@/lib/terminal";
import type { TerminalHealth } from "../../agent-dock/use-terminal-health";
import type { PilotControls } from "../use-pilot-controls";

interface PilotStatus {
  state: PilotState;
  controls: PilotControls;
  health: TerminalHealth;
  hostStatus: SessionStatus | null;
}

const PilotStatusContext = createContext<PilotStatus | null>(null);

interface PilotStatusProviderProps extends PilotStatus {
  children: ReactNode;
}

/**
 * Scoped to the overview tab, not the pilot layout: the host poll behind `health`
 * has no consumer on the instructions or journal tabs.
 */
export function PilotStatusProvider(props: PilotStatusProviderProps): ReactElement {
  const { children, ...status } = props;
  return <PilotStatusContext value={status}>{children}</PilotStatusContext>;
}

export function usePilotStatus(): PilotStatus {
  const status = use(PilotStatusContext);
  if (!status) {
    throw new Error("usePilotStatus must be used within a PilotStatusProvider");
  }
  return status;
}
