"use client";

import type { ReactElement } from "react";
import { Grid, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { analyticsQueries } from "@/api/queries";
import { RankedBarList } from "@/components/ui/data";
import { TimelineChart } from "@/components/ui/data/timeline-chart";
import { DetailSkeleton, QueryError } from "@/components/ui/feedback";
import { FOUND_VIA } from "../networking/found-via";
import { AnalyticsStatTiles } from "./analytics-stat-tiles";
import { NetworkingStatTiles } from "./networking-stat-tiles";
import { StatusBreakdownChart } from "./status-breakdown-chart";

export function AnalyticsView(): ReactElement {
  const query = useQuery(analyticsQueries.stats());

  if (query.isPending) {
    return <DetailSkeleton heights={[96, 280, 240]} />;
  }

  if (!query.data) {
    return <QueryError title="Couldn't load analytics." onRetry={() => void query.refetch()} />;
  }

  const stats = query.data;

  return (
    <Stack spacing={3}>
      <Typography variant="overlineMuted">Applications</Typography>
      <AnalyticsStatTiles stats={stats} />

      <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TimelineChart
            data={stats.perDay}
            eyebrow="Applications over time"
            metricLabel="submitted"
            emptyMessage="No applications submitted yet."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <StatusBreakdownChart data={stats.statusBreakdown} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <RankedBarList
            eyebrow="Distribution"
            title="Top boards"
            entries={stats.topBoards.map((b) => ({ label: b.board, count: b.count }))}
            emptyMessage="No applications have been linked to a job board yet."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <RankedBarList
            eyebrow="Diagnostics"
            title="Top failure reasons"
            entries={stats.topRejectReasons.map((r) => ({ label: r.reason, count: r.count }))}
            emptyMessage="No failed applications recorded."
          />
        </Grid>
      </Grid>

      <Typography variant="overlineMuted" sx={{ mt: 1 }}>
        Networking
      </Typography>
      <NetworkingStatTiles networking={stats.networking} />

      <Grid container spacing={2} sx={{ alignItems: "stretch" }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <TimelineChart
            data={stats.networking.perDaySent}
            eyebrow="Messages over time"
            metricLabel="sent"
            emptyMessage="No networking messages sent yet."
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <RankedBarList
            eyebrow="Distribution"
            title="Contact sources"
            entries={stats.networking.topContactSources.map((s) => ({
              label: FOUND_VIA[s.source],
              count: s.count,
            }))}
            emptyMessage="No contacts discovered yet."
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
