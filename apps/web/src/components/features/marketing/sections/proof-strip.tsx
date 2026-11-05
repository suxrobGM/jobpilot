import type { ReactElement } from "react";
import { Box, Grid, Stack, Typography } from "@mui/material";
import { cacheLife } from "next/cache";
import { api } from "@/api/client";
import { formatCount } from "@/utils/format";

const BOARDS = [
  "LinkedIn",
  "Indeed",
  "Hiring Cafe",
  "We Work Remotely",
  "Wellfound",
  "Y Combinator",
  "Welcome to the Jungle",
  "HN Who's Hiring",
  "Remote OK",
  "4 Day Week",
  "Upwork",
];

interface Stat {
  value: string;
  label: string;
}

/** A failed fetch drops only its numbers: a decorative strip must never 500 the page. */
export async function ProofStrip(): Promise<ReactElement> {
  "use cache";
  cacheLife("hours");

  const stats = await loadStats();

  return (
    <Stack
      spacing={{ xs: 3, md: 4 }}
      aria-label="JobPilot in numbers"
      sx={{ mt: { xs: 5, md: 7 } }}
    >
      <Grid container rowSpacing={3} sx={{ justifyContent: "center" }}>
        {stats.map((stat) => (
          <Grid
            key={stat.label}
            size={4}
            sx={{
              textAlign: "center",
              paddingInline: 1,
              "& + &": { borderLeft: 1, borderColor: "line.divider" },
            }}
          >
            <Typography variant="statValue" component="p">
              {stat.value}
            </Typography>
            <Typography variant="statLabel" component="p" sx={{ mt: 1 }}>
              {stat.label}
            </Typography>
          </Grid>
        ))}
      </Grid>
      <Box
        component="ul"
        sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1, m: 0, p: 0 }}
      >
        {BOARDS.map((board) => (
          <Typography key={board} component="li" variant="monoChip" sx={{ listStyle: "none" }}>
            {board}
          </Typography>
        ))}
        <Typography
          component="li"
          variant="monoChip"
          sx={{ listStyle: "none", color: "primary.main", borderStyle: "dashed" }}
        >
          + any site you add
        </Typography>
      </Box>
    </Stack>
  );
}

async function loadStats(): Promise<Stat[]> {
  const { data } = await api.public.stats.get().catch(() => ({ data: null }));
  if (!data) {
    return [];
  }

  return [
    { value: data.jobListings, label: "Jobs found by agents" },
    { value: data.applicationsLast30Days, label: "Applications this month" },
    { value: data.activeUsersLast30Days, label: "People applying this month" },
  ]
    .filter((stat) => stat.value > 0)
    .map((stat) => ({ value: formatCount(stat.value), label: stat.label }));
}
