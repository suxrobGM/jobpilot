"use client";

import type { ReactElement } from "react";
import { Add, PlayArrow } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import { useAgent } from "@/providers/agent-provider";
import { type PipelineColumnPage, type PipelineJobDto, type PipelineStage } from "@/types/api";
import { PipelineBoard } from "./pipeline-board";
import { PipelineFilterBar } from "./pipeline-filter-bar";
import { usePipelineFilters } from "./use-pipeline-filters";

function useStageTotal(stage: PipelineStage): number {
  const query = useApiQuery<PipelineColumnPage>(queryKeys.pipeline.total(stage), () =>
    apiClient.get<PipelineColumnPage>(`/api/pipeline?stage=${stage}&limit=1`),
  );
  return query.data?.total ?? 0;
}

export function PipelineView(): ReactElement {
  const router = useRouter();
  const { expand } = useAgent();
  const { filters } = usePipelineFilters();
  const discovered = useStageTotal("discovered");
  const queued = useStageTotal("queued");
  const applying = useStageTotal("applying");
  const submitted = useStageTotal("submitted");
  const replied = useStageTotal("replied");
  const total = discovered + queued + applying + submitted + replied;

  return (
    <Stack sx={{ height: "100%", minHeight: 0 }}>
      <Stack
        sx={(theme) => ({
          paddingInline: 2.5,
          paddingTop: 3,
          paddingBottom: 2,
          borderBottom: `1px solid ${theme.palette.line.divider}`,
          gap: 2,
        })}
      >
        <Stack
          direction="row"
          sx={{ alignItems: "flex-end", justifyContent: "space-between", gap: 2 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overlineMuted">Workspace</Typography>
            <Typography
              variant="h1"
              sx={{ fontSize: "1.5rem", mt: 0.5, letterSpacing: "-0.015em" }}
            >
              Pipeline
            </Typography>
            <Typography variant="body2Muted" sx={{ mt: 0.5 }}>
              {total} jobs · {submitted} submitted · {replied} replied
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button variant="outlined" size="small" startIcon={<Add fontSize="md" />}>
              Add URLs
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<PlayArrow fontSize="md" />}
              onClick={() => expand()}
            >
              Open agent
            </Button>
          </Stack>
        </Stack>

        <PipelineFilterBar />
      </Stack>

      <PipelineBoard
        filters={filters}
        onJobClick={(job: PipelineJobDto) => {
          if (job.applicationId !== null) {
            router.push(`/applications/${job.applicationId}` as Parameters<typeof router.push>[0]);
          } else if (job.runId !== null) {
            router.push(`/runs/${job.runId}` as Parameters<typeof router.push>[0]);
          }
        }}
      />
    </Stack>
  );
}
