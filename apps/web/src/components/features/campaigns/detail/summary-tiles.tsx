"use client";

import type { ReactElement } from "react";
import { Grid } from "@mui/material";
import type { CampaignDetailDto } from "@/api/types";
import { StatCard } from "@/components/ui/display";

interface CampaignSummaryTilesProps {
  campaign: CampaignDetailDto;
}

export function CampaignSummaryTiles(props: CampaignSummaryTilesProps): ReactElement {
  const { campaign } = props;
  const s = campaign.summary;
  const showRemaining = typeof campaign.config.maxApplications === "number";
  const tileSize = { xs: 6, sm: 4, md: 2 };

  return (
    <Grid container spacing={2}>
      <Grid size={tileSize}>
        <StatCard label="Found" value={s.totalFound} />
      </Grid>
      <Grid size={tileSize}>
        <StatCard label="Qualified" value={s.qualified} />
      </Grid>
      <Grid size={tileSize}>
        <StatCard label="Applied" value={s.applied} />
      </Grid>
      <Grid size={tileSize}>
        <StatCard label="Failed" value={s.failed} />
      </Grid>
      <Grid size={tileSize}>
        <StatCard label="Skipped" value={s.skipped} />
      </Grid>
      {showRemaining && (
        <Grid size={tileSize}>
          <StatCard label="Remaining" value={s.remaining} />
        </Grid>
      )}
    </Grid>
  );
}
