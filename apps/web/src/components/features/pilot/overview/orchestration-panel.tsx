"use client";

import { type ReactElement, useEffect, useState } from "react";
import type { PilotState } from "@jobpilot/contracts/pilot";
import { Box, Skeleton, Typography } from "@mui/material";
import { SectionCard } from "@/components/ui/layout";
import type { SessionStatus } from "@/lib/terminal";
import type { TerminalHealth } from "../../agent-dock/use-terminal-health";
import { OrchestrationFlow } from "./orchestration-flow";
import { usePilotStage } from "./use-pilot-stage";

interface OrchestrationPanelProps {
  state: PilotState;
  health: TerminalHealth;
  hostStatus: SessionStatus | null;
}

/** Live simulation of the pilot loop: conductor wakes the agent, which delegates to a worker acting on the board. */
export function OrchestrationPanel(props: OrchestrationPanelProps): ReactElement {
  const { state, health, hostStatus } = props;
  const stage = usePilotStage({ state, health, hostStatus });

  // ReactFlow measures the DOM on mount; hold the canvas until the client has mounted so it
  // never renders during SSR/prerender.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hint =
    stage.mode === "off"
      ? "Enable the pilot to watch it run cycles."
      : stage.mode === "offline"
        ? "Start the JobPilot agent so the pilot can run cycles."
        : null;

  return (
    <SectionCard title="Orchestration" description="How the pilot works a cycle, live.">
      {mounted ? <OrchestrationFlow stage={stage} /> : <Skeleton variant="rounded" height={240} />}
      <Box sx={{ mt: 1 }}>
        {hint ? (
          <Typography variant="body2Muted">{hint}</Typography>
        ) : (
          <Typography variant="captionMuted">
            Each cycle the conductor wakes the agent, which senses the agenda and delegates a worker
            to act on the job board.
          </Typography>
        )}
      </Box>
    </SectionCard>
  );
}
