"use client";

import { type ReactElement, useState } from "react";
import { Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { leaderboardQueries } from "@/api/queries";
import type { LeaderboardDto, LeaderboardRow, LeaderboardWindow } from "@/api/types";
import { EmptyState, TableSkeleton } from "@/components/ui/feedback";
import { plural } from "@/utils/format";
import { LeaderboardList } from "./leaderboard-list";
import { LeaderboardPodium } from "./leaderboard-podium";

interface LeaderboardViewProps {
  /** Server-fetched window, reused as `initialData` so the SEO HTML is not discarded. */
  initial?: LeaderboardDto;
}

const DEFAULT_WINDOW: LeaderboardWindow = "month";

const WINDOWS: { value: LeaderboardWindow; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "All time" },
];

const WINDOW_SUFFIX: Record<LeaderboardWindow, string> = {
  week: "this week",
  month: "this month",
  all: "so far",
};

export function LeaderboardView(props: LeaderboardViewProps): ReactElement {
  const { initial } = props;
  const [range, setRange] = useState<LeaderboardWindow>(initial?.window ?? DEFAULT_WINDOW);

  const query = useQuery({
    ...leaderboardQueries.list(range),
    initialData: range === initial?.window ? initial : undefined,
    // Matches the API's own leaderboard cache, so a remount does not re-fetch the same board.
    staleTime: 5 * 60_000,
    // Holds the old window's rows on screen while the next loads, instead of blanking.
    placeholderData: keepPreviousData,
  });

  const rows = query.data?.rows ?? [];
  const totalActive = query.data?.totalActive ?? 0;

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={range}
          onChange={(_, next: LeaderboardWindow | null) => {
            if (next) setRange(next);
          }}
          sx={{ alignSelf: { xs: "stretch", sm: "flex-start" } }}
        >
          {WINDOWS.map((w) => (
            <ToggleButton key={w.value} value={w.value} sx={{ flex: { xs: 1, sm: "none" } }}>
              {w.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {totalActive > 0 && (
          <Typography variant="body2Muted">
            {totalActive > rows.length
              ? `Top ${rows.length} of ${totalActive} people active ${WINDOW_SUFFIX[range]}`
              : `${plural(totalActive, "person", "people")} active ${WINDOW_SUFFIX[range]}`}
          </Typography>
        )}
      </Stack>

      <LeaderboardBody
        rows={rows}
        loading={query.isFetching}
        failed={query.isError}
        onRetry={() => void query.refetch()}
      />
    </Stack>
  );
}

interface LeaderboardBodyProps {
  rows: LeaderboardRow[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
}

function LeaderboardBody(props: LeaderboardBodyProps): ReactElement {
  const { rows, loading, failed, onRetry } = props;

  // A failed fetch must not read as "nobody is here".
  if (failed) {
    return (
      <EmptyState
        title="Could not load the leaderboard"
        description="Something went wrong on our side. Try again in a moment."
        action={
          <Button variant="outlined" onClick={onRetry}>
            Retry
          </Button>
        }
      />
    );
  }

  if (rows.length === 0 && loading) {
    return <TableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nobody is on the board yet"
        description="Nobody has applied or sent a message in this window. Pick a longer one, or start applying yourself."
      />
    );
  }

  return (
    <Stack spacing={3} sx={{ opacity: loading ? 0.5 : 1, transition: "opacity 120ms" }}>
      <LeaderboardPodium rows={rows} />
      {rows.length > 3 && <LeaderboardList rows={rows.slice(3)} />}
    </Stack>
  );
}
