"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import { PIPELINE_STAGES, type PipelineJobDto } from "@/api/types";
import { PipelineColumn } from "./board/column";
import { usePipelineFilters } from "./hooks/use-pipeline-filters";

export function PipelineView(): ReactElement {
  const router = useRouter();
  const { filters } = usePipelineFilters();

  const handleJobClick = (job: PipelineJobDto): void => {
    if (job.applicationId !== null) {
      router.push(`/applications/${job.applicationId}` as Parameters<typeof router.push>[0]);
    } else if (job.campaignId !== null) {
      router.push(`/campaigns/${job.campaignId}` as Parameters<typeof router.push>[0]);
    } else if (job.url) {
      window.open(job.url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Stack
      direction="row"
      spacing={1.5}
      sx={{
        flex: 1,
        minHeight: 0,
        paddingInline: 2.5,
        paddingBlock: 2,
        overflowX: "auto",
      }}
    >
      {PIPELINE_STAGES.map((stage) => (
        <PipelineColumn
          key={stage}
          stage={stage}
          filters={filters}
          onJobClick={handleJobClick}
          scopedOut={filters.campaignId !== null && stage === "queued"}
        />
      ))}
    </Stack>
  );
}
