"use client";

import type { ReactElement } from "react";
import { ArrowBack } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
import { JobDetail } from "@/components/features/pipeline/jobs/job-detail";
import { usePageKeys } from "@/hooks/use-page-keys";
import { THREAD_WIDTH } from "./thread/thread";

interface JobPaneProps {
  job: PipelineJobDto;
  onBack: () => void;
  /** Moves to the next (1) or previous (-1) parked job. */
  onStep: (direction: 1 | -1) => void;
}

/** A parked job in place of the conversation; Esc goes back, J/K step through parked jobs. */
export function JobPane(props: JobPaneProps): ReactElement {
  const { job, onBack, onStep } = props;

  usePageKeys({ Escape: onBack, j: () => onStep(1), k: () => onStep(-1) });

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
