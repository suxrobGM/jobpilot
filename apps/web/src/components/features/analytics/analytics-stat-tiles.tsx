"use client";

import type { ReactElement } from "react";
import { Grid } from "@mui/material";
import type { AnalyticsStatsDto } from "@/api/types";
import { StatTile } from "./stat-tile";

interface AnalyticsStatTilesProps {
  stats: AnalyticsStatsDto;
}

export function AnalyticsStatTiles(props: AnalyticsStatTilesProps): ReactElement {
  const { stats } = props;
  const { totals, thisWeek, responseRatePct } = stats;

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile
          label="Total"
          value={totals.applications}
          hint={`${totals.queueDepth} in queue`}
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile
          label="Submitted"
          value={totals.submitted}
          hint={`${thisWeek.submitted} this week`}
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile
          label="Interviewing"
          value={totals.interviewing}
          hint={`${thisWeek.interviewing} this week`}
          accent="warning"
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Offers" value={totals.offers} accent="success" />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile
          label="Rejected"
          value={totals.rejected}
          hint={`${thisWeek.rejected} this week`}
          accent="danger"
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Response rate" value={`${responseRatePct}%`} />
      </Grid>
    </Grid>
  );
}
