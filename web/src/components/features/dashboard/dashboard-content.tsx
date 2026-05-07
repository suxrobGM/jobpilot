"use client";

import type { ReactElement } from "react";
import { LinearProgress, Stack } from "@mui/material";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { DashboardStats } from "@/types/api";
import { BoardBreakdown } from "./board-breakdown";
import { FunnelChart } from "./funnel-chart";
import { KpiTiles } from "./kpi-tiles";
import { RecentActivity } from "./recent-activity";

export function DashboardContent(): ReactElement {
  const stats = useApiQuery<DashboardStats>(queryKeys.dashboard.stats(), () =>
    apiClient.get<DashboardStats>("/api/dashboard/stats"),
  );

  if (stats.isLoading || !stats.data) {
    return <LinearProgress />;
  }

  return (
    <>
      <KpiTiles stats={stats.data} />
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ "& > *": { flex: 1 } }}>
        <FunnelChart stats={stats.data} />
        <BoardBreakdown stats={stats.data} />
      </Stack>
      <RecentActivity />
    </>
  );
}
