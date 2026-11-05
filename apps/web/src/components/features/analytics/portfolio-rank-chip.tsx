"use client";

import type { ReactElement } from "react";
import { EmojiEvents, Share } from "@mui/icons-material";
import { Chip, Stack } from "@mui/material";
import Link from "next/link";
import { useApiQuery } from "@/api/hooks";
import { leaderboardQueries, userQueries } from "@/api/queries";

/** Nudges the analytics viewer toward their public page; shows their leaderboard rank when they have one. */
export function PortfolioRankChip(): ReactElement {
  const settings = useApiQuery(userQueries.portfolio());
  const board = useApiQuery(leaderboardQueries.list("all"));

  const username = settings.data?.username;
  const rank = username
    ? board.data?.rows.find((row) => row.username === username)?.rank
    : undefined;

  return (
    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
      {rank !== undefined && (
        <Chip
          component={Link}
          href="/leaderboard"
          size="medium"
          clickable
          icon={<EmojiEvents />}
          color="warning"
          variant="outlined"
          label={`Your rank #${rank}`}
        />
      )}
      <Chip
        component={Link}
        href="/portfolio"
        size="medium"
        clickable
        icon={<Share />}
        variant="outlined"
        label="Share your portfolio"
      />
    </Stack>
  );
}
