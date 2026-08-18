"use client";

import type { ReactElement } from "react";
import { INTERVIEW_STATUSES } from "@jobpilot/contracts/application";
import { Grid } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { applicationQueries, campaignQueries } from "@/api/queries";
import { StatCard } from "@/components/ui/display";

export function StatTiles(): ReactElement {
  const campaigns = useApiQuery(campaignQueries.list());
  // Counts come from the server aggregate, not a loaded page - these are whole-account totals.
  const applications = useApiQuery(applicationQueries.summary());

  const rows = campaigns.data?.items ?? [];
  const byStatus = applications.data?.byStatus;

  const active = rows.filter((c) => c.status === "in_progress" || c.status === "paused").length;
  const interviewing = INTERVIEW_STATUSES.reduce((n, s) => n + (byStatus?.[s] ?? 0), 0);
  const replies = rows.reduce(
    (n, c) => n + (c.summary.kind === "networking" ? c.summary.replied : 0),
    0,
  );

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Active campaigns" value={active} hint="running or paused" />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Applied" value={applications.data?.total ?? 0} hint="all time" />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Interviewing" value={interviewing} hint="past the first reply" />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Replies" value={replies} hint="to your networking messages" />
      </Grid>
    </Grid>
  );
}
