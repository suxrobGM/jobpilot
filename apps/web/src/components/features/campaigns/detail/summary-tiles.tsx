"use client";

import type { ReactNode } from "react";
import { Grid } from "@mui/material";
import type { CampaignDetailDto } from "@/api/types";
import { StatCard } from "@/components/ui/display";

interface CampaignSummaryTilesProps {
  campaign: CampaignDetailDto;
}

export function CampaignSummaryTiles(props: CampaignSummaryTilesProps): ReactNode {
  const { campaign } = props;
  const s = campaign.summary;
  if (s.kind !== "jobs") {
    return null;
  }
  const tiles = [
    { label: "Found", value: s.totalFound },
    { label: "Qualified", value: s.qualified },
    { label: "Applied", value: s.applied },
    { label: "Failed", value: s.failed },
    { label: "Skipped", value: s.skipped },
  ];

  // Remaining only means something against a cap.
  if (typeof campaign.config.maxApplications === "number") {
    tiles.push({ label: "Remaining", value: s.remaining });
  }

  return (
    <Grid container spacing={2}>
      {tiles.map((tile) => (
        <Grid key={tile.label} size={{ xs: 6, sm: 4, md: 2 }}>
          <StatCard label={tile.label} value={tile.value} />
        </Grid>
      ))}
    </Grid>
  );
}
