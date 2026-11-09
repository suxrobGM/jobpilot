"use client";

import type { ReactElement } from "react";
import { Share } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useCopy } from "@/hooks/use-copy";
import { AgentCard } from "./agent-card";

/** Install commands are useless on a phone, so this sends the setup page to a computer. */
export function SetupOnComputerCard(): ReactElement {
  const copy = useCopy();

  const sendLink = async (): Promise<void> => {
    const url = `${window.location.origin}/install`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Set up JobPilot", url });
      } catch {
        // share sheet dismissed
      }
      return;
    }
    await copy(url, "Setup link copied");
  };

  return (
    <AgentCard
      title="Set up JobPilot on your computer"
      description="The agent runs on a computer with Claude Code or Codex. Open the setup page there; once the agent runs, you can follow it and chat with it from this phone."
    >
      <Button
        variant="contained"
        size="small"
        startIcon={<Share />}
        onClick={() => void sendLink()}
        sx={{ alignSelf: "flex-start" }}
      >
        Send setup link
      </Button>
    </AgentCard>
  );
}
