"use client";

import { Stack } from "@mui/material";
import type { ReactElement } from "react";
import { StatCard } from "@/components/ui/display/stat-card";
import type { DashboardStats } from "@/types/api";

interface KpiTilesProps {
  stats: DashboardStats;
}

export function KpiTiles(props: KpiTilesProps): ReactElement {
  const { stats } = props;
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{ flexWrap: "wrap", "& > *": { flex: "1 1 220px" } }}
    >
      <StatCard label="Total applied" value={stats.total} hint="All time" />
      <StatCard
        label="Last 7 days"
        value={stats.last7Days}
        hint={`${stats.last30Days} in 30d`}
      />
      <StatCard
        label="Positive response"
        value={`${stats.positiveResponseRate}%`}
        hint="Past recruiter screen"
      />
      <StatCard
        label="In progress"
        value={
          stats.byStage.recruiter_screen +
          stats.byStage.assessment +
          stats.byStage.hiring_manager_screen +
          stats.byStage.technical_interview +
          stats.byStage.onsite
        }
        hint="Active conversations"
      />
    </Stack>
  );
}
