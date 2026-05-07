"use client";

import { Container, LinearProgress, Stack } from "@mui/material";
import type { ReactElement } from "react";
import { PageHeader } from "@/components/ui/layout/page-header";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { DashboardStats } from "@/types/api";
import { BoardBreakdown } from "./board-breakdown";
import { FunnelChart } from "./funnel-chart";
import { KpiTiles } from "./kpi-tiles";
import { RecentActivity } from "./recent-activity";

export function DashboardPageClient(): ReactElement {
  const stats = useApiQuery<DashboardStats>(
    queryKeys.dashboard.stats(),
    () => apiClient.get<DashboardStats>("/api/dashboard/stats"),
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <PageHeader
          eyebrow="JobPilot"
          title="Dashboard"
          description="Snapshot of your job search across every board and skill."
        />
        {stats.isLoading || !stats.data ? (
          <LinearProgress />
        ) : (
          <>
            <KpiTiles stats={stats.data} />
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              sx={{ "& > *": { flex: 1 } }}
            >
              <FunnelChart stats={stats.data} />
              <BoardBreakdown stats={stats.data} />
            </Stack>
            <RecentActivity />
          </>
        )}
      </Stack>
    </Container>
  );
}
