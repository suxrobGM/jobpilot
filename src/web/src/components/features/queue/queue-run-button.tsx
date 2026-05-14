"use client";

import type { ReactElement } from "react";
import { PlayArrow } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useAgent } from "@/providers/agent-provider";

export function QueueRunButton(): ReactElement {
  const { injectSkill, expand } = useAgent();

  const handleClick = async (): Promise<void> => {
    expand("terminal");
    await injectSkill("apply");
  };

  return (
    <Button variant="outlined" startIcon={<PlayArrow />} onClick={handleClick}>
      Run apply
    </Button>
  );
}
