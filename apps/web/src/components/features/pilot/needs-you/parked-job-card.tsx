"use client";

import type { ReactElement } from "react";
import { PauseCircleOutlined } from "@mui/icons-material";
import { Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import type { PipelineJobDto } from "@/api/types";
import { jobPageHref } from "@/utils/routes";

interface ParkedJobCardProps {
  job: PipelineJobDto;
}

/** A job the pilot stopped on; it opens on its own page. */
export function ParkedJobCard(props: ParkedJobCardProps): ReactElement {
  const { job } = props;
  return (
    <Card variant="interactive">
      <CardActionArea href={jobPageHref(job.id)}>
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
