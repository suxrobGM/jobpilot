"use client";

import { type ReactElement, useEffect } from "react";
import { ArrowBack } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
import { JobDetail } from "@/components/features/pipeline/jobs/job-detail";
import { THREAD_WIDTH } from "./thread/thread";

/** Typing in a field keeps its letters; only page-level keys move through the queue. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

interface JobPaneProps {
  job: PipelineJobDto;
  onBack: () => void;
  /** Moves to the next (1) or previous (-1) parked job. */
  onStep: (direction: 1 | -1) => void;
}

/** A parked job in place of the conversation; Esc goes back, J/K step through parked jobs. */
export function JobPane(props: JobPaneProps): ReactElement {
  const { job, onBack, onStep } = props;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.key === "Escape") {
        onBack();
      } else if (event.key === "j") {
        onStep(1);
      } else if (event.key === "k") {
        onStep(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <Stack spacing={2} sx={{ maxWidth: THREAD_WIDTH, mx: "auto", py: 1 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Button color="inherit" startIcon={<ArrowBack fontSize="md" />} onClick={onBack}>
            Back
          </Button>
          <Typography
            variant="captionMuted"
            sx={{ ml: "auto", display: { xs: "none", md: "block" } }}
          >
            Esc back · J / K next
          </Typography>
        </Stack>
        <JobDetail job={job} />
      </Stack>
    </Box>
  );
}
