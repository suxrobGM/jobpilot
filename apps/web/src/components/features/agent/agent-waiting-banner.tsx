"use client";

import { type ReactNode, useState } from "react";
import { Alert, Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { pilotQueries } from "@/api/queries";
import { useTerminalHealth } from "@/hooks/use-terminal-health";
import { useAgentDrawer } from "@/providers/agent-provider";
import { plural } from "@/utils/format";
import { pilotMode } from "../pilot/state/pilot-mode";

/** Requests queue silently while the agent is away; this says so on every page. */
export function AgentWaitingBanner(): ReactNode {
  const { data: state } = useQuery(pilotQueries.state());
  const { health, status } = useTerminalHealth();
  const { openDrawer } = useAgentDrawer();
  const pathname = usePathname();
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  if (!state || pathname.startsWith("/onboarding")) {
    return null;
  }
  const waiting = state.pendingRequests;
  const offline = pilotMode(state, health, status?.pilot ?? null) === "offline";
  // A dismissal holds until more work queues up.
  if (!offline || waiting === 0 || (dismissedAt !== null && waiting <= dismissedAt)) {
    return null;
  }

  return (
    <Alert
      severity="warning"
      onClose={() => setDismissedAt(waiting)}
      sx={{ borderRadius: 0 }}
      action={
        <Button color="inherit" size="small" onClick={openDrawer}>
          Start agent
        </Button>
      }
    >
      {plural(waiting, "request")} waiting for the agent. Start it on your computer.
    </Alert>
  );
}
