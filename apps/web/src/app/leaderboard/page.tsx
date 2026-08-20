import type { ReactElement } from "react";
import { Stack, Typography } from "@mui/material";
import type { Metadata } from "next";
import { api } from "@/api/client";
import { getPublicFetchOptions } from "@/api/server";
import { LeaderboardView } from "@/components/features/portfolio";

export const metadata: Metadata = {
  title: "Trending users",
  description:
    "The most active JobPilot users, ranked by applications sent and networking outreach.",
  alternates: { canonical: "/leaderboard" },
};

/** Server-fetch the default window for SEO; the client view refetches on toggle. */
async function getLeaderboard() {
  const { data } = await api.public.portfolio.leaderboard.get({
    query: { window: "month" },
    ...(await getPublicFetchOptions()),
  });
  return data;
}

export default async function LeaderboardPage(): Promise<ReactElement> {
  const board = await getLeaderboard();

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.9rem", md: "2.4rem" } }}>
          Trending users
        </Typography>
        <Typography variant="body1Muted">
          The most active people on JobPilot, ranked by applications and networking outreach.
        </Typography>
      </Stack>
      {/* A failed server fetch hands over nothing, so the client shows its error state, not "empty". */}
      <LeaderboardView initial={board ?? undefined} />
    </Stack>
  );
}
