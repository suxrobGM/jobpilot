"use client";

import type { ReactElement } from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { apiClient } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { AnalyticsStatsDto } from "@/api/types";
import { AnalyticsStatTiles } from "./analytics-stat-tiles";
import { ApplicationsTimelineChart } from "./applications-timeline-chart";
import { OutreachStatTiles } from "./outreach-stat-tiles";
import { StageBreakdownChart } from "./stage-breakdown-chart";
import { TopBoardsList } from "./top-boards-list";

function toEntries<T extends { count: number }>(
  items: T[],
  label: (item: T) => string,
): { label: string; count: number }[] {
  return items.map((item) => ({ label: label(item), count: item.count }));
}

export function AnalyticsView(): ReactElement {
  const query = useApiQuery<AnalyticsStatsDto>(
    queryKeys.analytics.stats(),
    () => apiClient.get<AnalyticsStatsDto>("/api/analytics"),
    { errorMessage: "Failed to load analytics stats" },
  );

  if (query.isPending) {
    return <Typography variant="body2Muted">Loading analytics</Typography>;
  }

  if (!query.data) {
    return <Typography variant="body2Muted">No data available.</Typography>;
  }

  const stats = query.data;

  return (
    <Stack spacing={3}>
      <Typography variant="overlineMuted">Applications</Typography>
      <AnalyticsStatTiles stats={stats} />

      <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ApplicationsTimelineChart data={stats.perDay} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StageBreakdownChart data={stats.stageBreakdown} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopBoardsList
            eyebrow="Distribution"
            title="Top boards"
            entries={toEntries(stats.topBoards, (b) => b.board)}
            emptyMessage="No applications have been linked to a job board yet."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopBoardsList
            eyebrow="Diagnostics"
            title="Top failure reasons"
            entries={toEntries(stats.topRejectReasons, (r) => r.reason)}
            emptyMessage="No failed campaign jobs recorded."
          />
        </Grid>
      </Grid>

      <Typography variant="overlineMuted" sx={{ mt: 1 }}>
        Outreach
      </Typography>
      <OutreachStatTiles outreach={stats.outreach} />

      <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <ApplicationsTimelineChart
            data={stats.outreach.perDaySent}
            title="Messages over time"
            metricLabel="sent"
            emptyMessage="No outreach messages sent yet."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopBoardsList
            eyebrow="Distribution"
            title="Contact sources"
            entries={toEntries(stats.outreach.topContactSources, (s) => s.source)}
            emptyMessage="No contacts discovered yet."
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
