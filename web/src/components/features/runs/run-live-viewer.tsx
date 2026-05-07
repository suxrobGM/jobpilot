"use client";

import { Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { ReactElement } from "react";
import { SectionCard } from "@/components/ui/layout/section-card";
import { useApiQuery } from "@/hooks/use-api-query";
import { useRunEvents } from "@/hooks/use-run-events";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { RunStatus } from "@/lib/schemas/run";
import type { RunDetailDto } from "@/types/api";
import { RunJobsTable } from "./run-jobs-table";
import { RunSummaryTiles } from "./run-summary-tiles";

const STATUS_COLOR: Record<RunStatus, "default" | "info" | "success" | "error"> = {
  in_progress: "info",
  paused: "default",
  completed: "success",
  failed: "error",
};

interface RunLiveViewerProps {
  runId: string;
}

export function RunLiveViewer(props: RunLiveViewerProps): ReactElement {
  const { runId } = props;

  const detail = useApiQuery<RunDetailDto>(
    queryKeys.runs.detail(runId),
    () => apiClient.get<RunDetailDto>(`/api/runs/${encodeURIComponent(runId)}`),
  );

  useRunEvents(runId);

  if (detail.isLoading || !detail.data) {
    return <LinearProgress />;
  }

  const run = detail.data;

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Chip
          size="small"
          label={run.status}
          color={STATUS_COLOR[run.status]}
          variant="outlined"
        />
        <Typography variant="body2Muted">
          Source: {run.source} · Started {new Date(run.startedAt).toLocaleString()}
        </Typography>
      </Stack>
      <RunSummaryTiles run={run} />
      <SectionCard title="Jobs" description="Updated live as the autopilot runs.">
        <RunJobsTable rows={run.jobs} />
      </SectionCard>
    </Stack>
  );
}
