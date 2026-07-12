"use client";

import type { ReactElement } from "react";
import { DocumentScanner } from "@mui/icons-material";
import { Button } from "@mui/material";
import type { ResumeDto } from "@/api/types";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { buildCliArgs } from "@/utils/cli-args";

interface ExtractResumeButtonProps {
  resume: ResumeDto;
  size?: "small" | "medium";
}

export function ExtractResumeButton(props: ExtractResumeButtonProps): ReactElement | null {
  const { resume, size = "small" } = props;
  const agent = useAgent();
  const agentAvailable = useAgentAvailable();
  const confirm = useConfirm();

  const hasData = resume.content !== null;

  const run = async (force: boolean) => {
    await agent.injectSkill(
      "extract-resume",
      buildCliArgs({ positional: [resume.id], flags: { force } }),
    );
  };

  const handleClick = async (): Promise<void> => {
    if (!hasData) {
      void run(false);
      return;
    }
    const confirmed = await confirm({
      title: "Overwrite structured fields?",
      description: `"${resume.label}" already has structured data. Re-extracting will replace every field with what is parsed from the PDF. Manual edits will be lost.`,
      confirmLabel: "Overwrite",
      destructive: true,
    });
    if (confirmed) {
      void run(true);
    }
  };

  // Extraction runs the local agent, so this control is desktop-only.
  if (!agentAvailable) {
    return null;
  }

  return (
    <Button
      size={size}
      variant="outlined"
      startIcon={<DocumentScanner />}
      onClick={() => void handleClick()}
    >
      {hasData ? "Re-extract from PDF" : "Extract from PDF"}
    </Button>
  );
}
