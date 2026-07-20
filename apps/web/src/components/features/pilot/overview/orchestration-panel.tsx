"use client";

import { type ReactElement, useEffect, useState } from "react";
import { Box, Skeleton, Typography } from "@mui/material";
import { SectionCard } from "@/components/ui/layout";
import { OrchestrationFlow } from "./orchestration-flow";
import { type PilotStage, usePilotStage } from "./use-pilot-stage";

/** Only the blocked modes get a call to action; running ones fall back to the generic caption. */
const MODE_HINTS: Record<PilotStage["mode"], string | null> = {
  off: "Enable the pilot to watch it run cycles.",
  offline: "Start the JobPilot agent so the pilot can run cycles.",
  working: null,
  sleeping: null,
};

/** Live simulation of the pilot loop: conductor wakes the agent, which delegates to a worker acting on the board. */
export function OrchestrationPanel(): ReactElement {
  const stage = usePilotStage();

  // ReactFlow measures the DOM on mount; hold the canvas until the client has mounted so it
  // never renders during SSR/prerender.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hint = MODE_HINTS[stage.mode];

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
