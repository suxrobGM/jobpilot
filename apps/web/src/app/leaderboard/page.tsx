import { type ReactElement, Suspense } from "react";
import { Skeleton, Stack, Typography } from "@mui/material";
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

export default function LeaderboardPage(): ReactElement {
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
      {/* The ranking is live, so it streams rather than taking a guessed cache lifetime. */}
      <Suspense fallback={<Skeleton variant="rounded" height={480} />}>
        <Leaderboard />
      </Suspense>
    </Stack>
  );
}

/** Server-fetch the default window for SEO; the client view refetches on toggle. */
async function Leaderboard(): Promise<ReactElement> {
  const { data } = await api.public.portfolio.leaderboard.get({
    query: { window: "month" },
    ...(await getPublicFetchOptions()),
  });

  // A failed server fetch hands over nothing, so the client shows its error state, not "empty".
  return <LeaderboardView initial={data ?? undefined} />;
}
