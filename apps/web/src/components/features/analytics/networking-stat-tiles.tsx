"use client";

import type { ReactElement } from "react";
import { Grid } from "@mui/material";
import type { AnalyticsNetworkingStats } from "@/api/types";
import { StatCard } from "@/components/ui/display";

interface NetworkingStatTilesProps {
  networking: AnalyticsNetworkingStats;
}

export function NetworkingStatTiles(props: NetworkingStatTilesProps): ReactElement {
  const { networking } = props;
  const { totals, thisWeek, replyRatePct } = networking;

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatCard label="Contacts" value={totals.contacts} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatCard label="Sent" value={totals.sent} hint={`${thisWeek.sent} this week`} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatCard
          label="Replied"
          value={totals.replied}
          hint={`${thisWeek.replied} this week`}
          accent="success"
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatCard label="Reply rate" value={`${replyRatePct}%`} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatCard label="Bounced" value={totals.bounced} accent="danger" />
      </Grid>
    </Grid>
  );
}
