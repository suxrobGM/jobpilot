"use client";

import { useState, type ReactElement } from "react";
import { DocumentScanner } from "@mui/icons-material";
import { Button } from "@mui/material";
import type { ResumeDto } from "@/api/types";
import { ConfirmDialog } from "@/components/ui/feedback";
import { useAgent } from "@/providers/agent-provider";
import { buildCliArgs } from "@/utils/cli-args";

interface ExtractResumeButtonProps {
  resume: ResumeDto;
  size?: "small" | "medium";
}

export function ExtractResumeButton(props: ExtractResumeButtonProps): ReactElement {
  const { resume, size = "small" } = props;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const agent = useAgent();

  const hasData = resume.content !== null;

  const run = async (force: boolean) => {
    await agent.injectSkill(
      "extract-resume",
      buildCliArgs({ positional: [resume.id], flags: { force } }),
    );
  };

  const handleClick = () => {
    if (hasData) {
      setConfirmOpen(true);
    } else {
      void run(false);
    }
  };

  return (
    <>
      <Button size={size} variant="outlined" startIcon={<DocumentScanner />} onClick={handleClick}>
        {hasData ? "Re-extract from PDF" : "Extract from PDF"}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        title="Overwrite structured fields?"
        description={`"${resume.label}" already has structured data. Re-extracting will replace every field with what is parsed from the PDF. Manual edits will be lost.`}
        confirmLabel="Overwrite"
        destructive
        onConfirm={() => {
          setConfirmOpen(false);
          void run(true);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
