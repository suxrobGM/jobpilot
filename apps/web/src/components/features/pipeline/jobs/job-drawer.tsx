"use client";

import type { ReactElement } from "react";
import { Close } from "@mui/icons-material";
import { Box, Drawer, IconButton } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
import { JobDetail } from "./job-detail";

interface JobDrawerProps {
  job: PipelineJobDto | null;
  onClose: () => void;
}

export function JobDrawer(props: JobDrawerProps): ReactElement {
  const { job, onClose } = props;
  return (
    <Drawer anchor="right" open={job !== null} onClose={onClose}>
      {job && (
        <Box sx={{ p: 3, width: { xs: "100vw", sm: 440 } }}>
          <JobDetail
            job={job}
            action={
              <IconButton aria-label="Close" onClick={onClose}>
                <Close fontSize="sm" />
              </IconButton>
            }
          />
        </Box>
      )}
    </Drawer>
  );
}
