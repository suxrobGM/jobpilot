"use client";

import type { ReactNode } from "react";
import { EmojiEvents, Share } from "@mui/icons-material";
import { Button } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { leaderboardQueries, userQueries } from "@/api/queries";
import { PageActions } from "@/components/ui/layout";

/** Top-bar links to the viewer's public page, with their leaderboard rank when they have one. */
export function PortfolioActions(): ReactNode {
  const settings = useQuery(userQueries.portfolio());
  const board = useQuery(leaderboardQueries.list("all"));

  const username = settings.data?.username;
  const rank = username ? board.data?.rows.find((row) => row.username === username)?.rank : null;

  return (
    <PageActions>
      {rank != null && (
        <Button color="warning" startIcon={<EmojiEvents />} href="/leaderboard">
          Rank #{rank}
        </Button>
      )}
      <Button variant="outlined" startIcon={<Share />} href="/portfolio">
        Share your portfolio
      </Button>
    </PageActions>
  );
}
