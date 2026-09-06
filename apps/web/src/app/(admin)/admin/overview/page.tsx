import { type ReactElement, Suspense } from "react";
import { Grid, Skeleton, Stack } from "@mui/material";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/api/client";
import { getFetchOptions } from "@/api/server";
import { ApplicationsTimelineChart } from "@/components/features/analytics/applications-timeline-chart";
import { StatTile } from "@/components/features/analytics/stat-tile";
import { StatusBreakdownChart } from "@/components/features/analytics/status-breakdown-chart";
import { TopBoardsList } from "@/components/features/analytics/top-boards-list";
import { slotKeys } from "@/utils/array";

export const metadata: Metadata = { title: "Overview" };

/** Mirrors the tile count in `AdminOverview` below. */
const TILE_KEYS = slotKeys(7);

export default function AdminOverviewPage(): ReactElement {
  // Every tile and chart comes from one stats call, so the whole body streams.
  return (
    <Suspense fallback={<AdminOverviewSkeleton />}>
      <AdminOverview />
    </Suspense>
  );
}

function AdminOverviewSkeleton(): ReactElement {
  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        {TILE_KEYS.map((key) => (
          <Grid key={key} size={{ xs: 6, sm: 4, md: 3 }}>
            <Skeleton variant="rounded" height={92} />
          </Grid>
        ))}
      </Grid>
      <Skeleton variant="rounded" height={280} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
      </Grid>
    </Stack>
  );
}

/** Read-only, so it renders entirely on the server; only the charts ship as client leaves. */
async function AdminOverview(): Promise<ReactElement> {
  const { data } = await api.admin.stats.get(await getFetchOptions());

  if (!data) {
    notFound();
  }

  const { users, content, statusBreakdown, topBoards, signupsPerDay } = data;

  const tiles = [
    { label: "Users", value: users.total, hint: `${users.newThisWeek} joined this week` },
    { label: "Verified", value: users.verified, hint: `of ${users.total} accounts` },
    { label: "Admins", value: users.admins, hint: "incl. the super admin" },
    { label: "Active", value: users.active, hint: "in the last 30 days" },
    { label: "Campaigns", value: content.campaigns, hint: `${content.activeCampaigns} running` },
    {
      label: "Applications",
      value: content.applications,
      hint: `${content.applicationsThisWeek} this week`,
    },
    { label: "Boards", value: content.boards, hint: `${content.boardLinks} user links` },
  ];

  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        {tiles.map((tile) => (
          <Grid key={tile.label} size={{ xs: 6, sm: 4, md: 3 }}>
            <StatTile label={tile.label} value={tile.value} hint={tile.hint} />
          </Grid>
        ))}
      </Grid>

      <ApplicationsTimelineChart
        data={signupsPerDay}
        title="Signups"
        metricLabel="signups"
        emptyMessage="No signups in the last 30 days."
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <StatusBreakdownChart data={statusBreakdown} />
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <TopBoardsList
            title="Top boards"
            eyebrow="Platform"
            entries={topBoards.map((row) => ({ label: row.board, count: row.count }))}
            emptyMessage="No applications yet."
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
