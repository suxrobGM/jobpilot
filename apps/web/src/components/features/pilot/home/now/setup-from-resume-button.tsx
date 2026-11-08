"use client";

import type { ReactNode } from "react";
import { Button } from "@mui/material";
import { useCreateRequest } from "../../requests/use-create-request";

interface SetupFromResumeButtonProps {
  resumeCount: number;
}

/** Queues `search.setup`, which runs with autopilot off too and reads every resume. */
export function SetupFromResumeButton(props: SetupFromResumeButtonProps): ReactNode {
  const { resumeCount } = props;
  const request = useCreateRequest();
  if (resumeCount === 0) {
    return null;
  }
  const label =
    resumeCount === 1 ? "Set up from my resume" : `Set up from my ${resumeCount} resumes`;
  return (
    <Button
      size="small"
      variant="outlined"
      loading={request.isPending}
      onClick={() => request.mutate({ taskType: "search.setup", payload: {} })}
    >
      {label}
    </Button>
  );
}
