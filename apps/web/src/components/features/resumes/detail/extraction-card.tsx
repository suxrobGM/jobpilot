"use client";

import type { ReactElement } from "react";
import { Button, CircularProgress, Stack, Typography } from "@mui/material";
import { useCreateRequest } from "@/components/features/pilot/requests/use-create-request";
import { SectionCard } from "@/components/ui/layout";
import { useResumeExtraction } from "../use-resume-extraction";

interface ExtractionCardProps {
  resumeId: string;
  onSkip: () => void;
}

/** Without this, a first upload lands on an empty form with nothing saying the agent is working. */
export function ExtractionCard(props: ExtractionCardProps): ReactElement {
  const { resumeId, onSkip } = props;
  const request = useCreateRequest();
  useResumeExtraction(resumeId, true);

  return (
    <SectionCard title="Reading your PDF">
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <CircularProgress size={18} />
          <Typography variant="body2Muted">
            The pilot is pulling your details out of the PDF on your agent. It usually takes about a
            minute once the agent is running, and the fields fill in on their own.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" size="small" onClick={onSkip}>
            Fill it in myself
          </Button>
          <Button
            variant="text"
            size="small"
            loading={request.isPending}
            onClick={() =>
              request.mutate({ taskType: "resume.extract", payload: { resumeId, force: false } })
            }
          >
            Try again
          </Button>
        </Stack>
      </Stack>
    </SectionCard>
  );
}
