"use client";

import type { ReactElement } from "react";
import { Stack } from "@mui/material";
import { PipelineColumn } from "./pipeline-column";
import type { PipelineColumnData, PipelineJob } from "./types";

interface PipelineBoardProps {
  columns: PipelineColumnData[];
  onJobClick?: (job: PipelineJob) => void;
  onLoadMore?: (stage: PipelineColumnData["stage"]) => void;
}

export function PipelineBoard(props: PipelineBoardProps): ReactElement {
  const { columns, onJobClick, onLoadMore } = props;
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
      {columns.map((col) => (
        <PipelineColumn
          key={col.stage}
          data={col}
          onJobClick={onJobClick}
          onLoadMore={onLoadMore ? () => onLoadMore(col.stage) : undefined}
        />
      ))}
    </Stack>
  );
}
