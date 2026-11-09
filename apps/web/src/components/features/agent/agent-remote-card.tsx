"use client";

import type { ReactElement } from "react";
import { Button } from "@mui/material";
import { useAgentDrawer } from "@/providers/agent-provider";
import { AgentCard } from "./agent-card";

/** Terminal tab when the host runs on another device. */
export function AgentRemoteCard(): ReactElement {
  const { setDrawerTab } = useAgentDrawer();

  return (
    <AgentCard
      title="Agent is running on your computer"
      description="The terminal opens only on that computer. Here you can chat with the pilot, answer its questions and watch each step."
    >
      <Button
        variant="contained"
        size="small"
        onClick={() => setDrawerTab("steps")}
        sx={{ alignSelf: "flex-start" }}
      >
        Watch steps
      </Button>
    </AgentCard>
  );
}
