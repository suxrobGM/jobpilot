"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { PIPELINE_STAGES, type PipelineJobDto } from "@/types/api";
import { PipelineColumn } from "./pipeline-column";
import type { PipelineColumnFilters } from "./use-pipeline-column";

interface PipelineBoardProps {
  filters?: PipelineColumnFilters;
  onJobClick?: (job: PipelineJobDto) => void;
}

export function PipelineBoard(props: PipelineBoardProps): ReactElement {
  const { filters, onJobClick } = props;
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
        <PipelineColumn key={stage} stage={stage} filters={filters} onJobClick={onJobClick} />
      ))}
    </Stack>
  );
}
