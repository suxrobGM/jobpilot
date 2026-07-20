"use client";

import type { ReactElement } from "react";
import { Grid } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { applicationQueries, campaignQueries } from "@/api/queries";
import { StatCard } from "@/components/ui/display";
import { INTERVIEW_STATUSES } from "../applications/funnel-bar";

export function StatTiles(): ReactElement {
  const campaigns = useApiQuery(campaignQueries.list());
  const applications = useApiQuery(applicationQueries.list());

  const rows = campaigns.data ?? [];
  const apps = applications.data ?? [];

  const active = rows.filter((c) => c.status === "in_progress" || c.status === "paused").length;
  const interviewing = apps.filter((a) => INTERVIEW_STATUSES.has(a.status)).length;
  const replies = rows.reduce(
    (n, c) => n + (c.summary.kind === "networking" ? c.summary.replied : 0),
    0,
  );

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Active campaigns" value={active} />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Applied" value={apps.length} />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Interviewing" value={interviewing} />
      </Grid>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatCard label="Replies" value={replies} />
      </Grid>
    </Grid>
  );
}
