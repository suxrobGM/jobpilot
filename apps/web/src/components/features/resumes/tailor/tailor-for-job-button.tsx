"use client";

import { type ReactElement, useState } from "react";
import { AutoFixHigh } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useAgentAvailable } from "@/providers/agent-provider";
import { JobDescriptionDialog } from "./job-description-dialog";

interface TailorForJobButtonProps {
  size?: "small" | "medium";
}

export function TailorForJobButton(props: TailorForJobButtonProps): ReactElement | null {
  const { size = "small" } = props;
  const agentAvailable = useAgentAvailable();
  const [open, setOpen] = useState(false);

  // Tailoring runs the local agent, so this control is desktop-only.
  if (!agentAvailable) {
    return null;
  }

  return (
    <>
      <Button
        size={size}
        variant="contained"
        startIcon={<AutoFixHigh />}
        onClick={() => setOpen(true)}
      >
        Tailor for job
      </Button>
      <JobDescriptionDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
