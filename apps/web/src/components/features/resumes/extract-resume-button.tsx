"use client";

import type { ReactElement } from "react";
import { DocumentScanner } from "@mui/icons-material";
import { Button } from "@mui/material";
import type { ResumeDto } from "@/api/types";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { useConfirm } from "@/providers/confirm-provider";

interface ExtractResumeButtonProps {
  resume: ResumeDto;
  size?: "small" | "medium";
}

export function ExtractResumeButton(props: ExtractResumeButtonProps): ReactElement {
  const { resume, size = "small" } = props;
  const request = useCreateRequest();
  const confirm = useConfirm();

  const hasData = resume.content !== null;

  const run = async (force: boolean) => {
    await request.mutateAsync({
      taskType: "resume.extract",
      payload: { resumeId: resume.id, force },
    });
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
