"use client";

import type { ReactElement } from "react";
import { PauseCircleOutlined } from "@mui/icons-material";
import { Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";

interface ParkedJobCardProps {
  job: PipelineJobDto;
  selected: boolean;
  onOpen: () => void;
}

/** A job the pilot stopped on; opening it shows the job beside the conversation. */
export function ParkedJobCard(props: ParkedJobCardProps): ReactElement {
  const { job, selected, onOpen } = props;
  return (
    <Card
      variant="interactive"
      sx={(theme) =>
        selected ? { borderColor: "accent.primary", boxShadow: theme.shadows_custom.focus } : {}
      }
    >
      <CardActionArea aria-current={selected || undefined} onClick={onOpen}>
        <CardContent>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
            <PauseCircleOutlined fontSize="lg" sx={{ color: "warning.main", mt: 0.25 }} />
            <Stack spacing={0.25} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body1Strong">{job.title}</Typography>
              <Typography variant="body2Muted">
                {[job.company, job.failReason ?? "Parked until you take a look"]
                  .filter(Boolean)
                  .join(" · ")}
              </Typography>
            </Stack>
            {job.matchScore !== null && (
              <Typography variant="monoBody" sx={{ color: "success.main" }}>
                {job.matchScore}
              </Typography>
            )}
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
