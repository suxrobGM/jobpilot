"use client";

import type { ReactElement } from "react";
import { INTERVIEW_STATUSES } from "@jobpilot/contracts/application";
import { Grid } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { applicationQueries, campaignQueries } from "@/api/queries";
import { StatCard } from "@/components/ui/display";

export function StatTiles(): ReactElement {
  const campaigns = useApiQuery(campaignQueries.summary());
  const applications = useApiQuery(applicationQueries.summary());

  const byStatus = applications.data?.byStatus;
  const active = campaigns.data?.active ?? 0;
  const replies = campaigns.data?.replies ?? 0;
  const interviewing = INTERVIEW_STATUSES.reduce((n, s) => n + (byStatus?.[s] ?? 0), 0);

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
