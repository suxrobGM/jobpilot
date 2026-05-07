"use client";

import { Stack } from "@mui/material";
import type { ReactElement } from "react";
import { StatCard } from "@/components/ui/display/stat-card";
import type { RunDetailDto } from "@/types/api";

interface RunSummaryTilesProps {
  run: RunDetailDto;
}

export function RunSummaryTiles(props: RunSummaryTilesProps): ReactElement {
  const { run } = props;
  const s = run.summary;
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ flexWrap: "wrap", "& > *": { flex: "1 1 160px" } }}
    >
      <StatCard label="Found" value={s.totalFound} />
      <StatCard label="Qualified" value={s.qualified} />
      <StatCard label="Applied" value={s.applied} />
      <StatCard label="Failed" value={s.failed} />
      <StatCard label="Skipped" value={s.skipped} />
      <StatCard label="Remaining" value={s.remaining} />
    </Stack>
  );
}
