import type { ReactElement } from "react";
import { Grid } from "@mui/material";
import type { PortfolioStats } from "@/api/types";
import { StatCard } from "@/components/ui/display";

interface PortfolioStatsRowProps {
  stats: PortfolioStats;
}

interface Tile {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "success" | "warning";
}

export function PortfolioStatsRow(props: PortfolioStatsRowProps): ReactElement {
  const { stats } = props;
  const tiles: Tile[] = [
    {
      label: "Applications",
      value: stats.applications,
      hint: `${stats.applicationsLast30} in the last 30 days`,
    },
    { label: "Interviewing", value: stats.interviews, accent: "warning" },
    { label: "Messages sent", value: stats.messagesSent },
    {
      label: "Current streak",
      value: `${stats.currentStreak}d`,
      hint: `longest ${stats.longestStreak}d`,
      accent: "success",
    },
  ];

  return (
    <Grid container spacing={1.5}>
      {tiles.map((tile) => (
        <Grid key={tile.label} size={{ xs: 6, md: 3 }}>
          <StatCard label={tile.label} value={tile.value} hint={tile.hint} accent={tile.accent} />
        </Grid>
      ))}
    </Grid>
  );
}
