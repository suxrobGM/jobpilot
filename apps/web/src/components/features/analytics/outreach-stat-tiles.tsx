"use client";

import type { ReactElement } from "react";
import { Grid } from "@mui/material";
import type { AnalyticsOutreachStats } from "@/api/types";
import { StatTile } from "./stat-tile";

interface OutreachStatTilesProps {
  outreach: AnalyticsOutreachStats;
}

export function OutreachStatTiles(props: OutreachStatTilesProps): ReactElement {
  const { outreach } = props;
  const { totals, thisWeek, replyRatePct } = outreach;

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Contacts" value={totals.contacts} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Sent" value={totals.sent} hint={`${thisWeek.sent} this week`} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile
          label="Replied"
          value={totals.replied}
          hint={`${thisWeek.replied} this week`}
          accent="success"
        />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Reply rate" value={`${replyRatePct}%`} />
      </Grid>
      <Grid size={{ xs: 6, sm: 4, md: 2 }}>
        <StatTile label="Bounced" value={totals.bounced} accent="danger" />
      </Grid>
    </Grid>
  );
}
