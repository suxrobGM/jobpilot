"use client";

import { type ReactElement, useState } from "react";
import { PauseCircleOutlined } from "@mui/icons-material";
import { Button, Stack, Tooltip, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { FeedDto } from "@/api/types";
import { plural } from "@/utils/format";
import { useMakeChange } from "../../changes/use-changes";

const SHOWN_SEARCHES = 3;

interface SearchRowProps {
  search: FeedDto;
}

function SearchRow(props: SearchRowProps): ReactElement {
  const { search } = props;
  const paused = search.pausedAt !== null;
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center", minHeight: 28 }}>
      <Typography
        variant="body2"
        noWrap
        title={search.query ?? undefined}
        sx={{ flex: 1, minWidth: 0, color: paused ? "text.secondary" : "text.primary" }}
      >
        {search.name}
        {search.board && (
          <Typography component="span" variant="body2Muted">
            {` · ${search.board.name}`}
          </Typography>
        )}
      </Typography>
      {paused && (
        <Tooltip title={search.pausedReason ?? "Paused"}>
          <PauseCircleOutlined fontSize="sm" sx={{ color: "text.secondary" }} />
        </Tooltip>
      )}
      {!paused && <Typography variant="body2Muted">{search.appliedThisWeek}</Typography>}
    </Stack>
  );
}

/** Active searches by this week's applications; the tail and the paused fold behind one line. */
export function SearchList(): ReactElement {
  const searches = useQuery(pilotQueries.searches()).data ?? [];
  const [expanded, setExpanded] = useState(false);
  const resume = useMakeChange();

  const active = searches
    .filter((search) => search.pausedAt === null)
    .sort((a, b) => b.appliedThisWeek - a.appliedThisWeek);

  const paused = searches.filter((search) => search.pausedAt !== null);
  const hidden = active.length - SHOWN_SEARCHES;
  const shown = expanded ? [...active, ...paused] : active.slice(0, SHOWN_SEARCHES);
  const folded: string[] = [];

  if (hidden > 0) {
    folded.push(`+${hidden} more`);
  }
  if (paused.length > 0) {
    folded.push(`${paused.length} paused`);
  }

  const resumeAll = (): void => {
    resume.mutate({
      summary: `Resumed ${plural(paused.length, "search", "searches")}`,
      actions: paused.map((search) => ({ type: "search.resume", searchId: search.id })),
    });
  };

  if (searches.length === 0) {
    return (
      <Typography variant="body2Muted">
        No searches yet. Tell the pilot what jobs you want.
      </Typography>
    );
  }
  return (
    <Stack spacing={0.25}>
      <Stack direction="row" sx={{ justifyContent: "space-between" }}>
        <Typography variant="captionMuted">Searches</Typography>
        <Typography variant="captionMuted">applied / week</Typography>
      </Stack>
      {shown.map((search) => (
        <SearchRow key={search.id} search={search} />
      ))}
      {folded.length > 0 && (
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Button
            size="small"
            color="inherit"
            onClick={() => setExpanded(!expanded)}
            sx={{ minWidth: 0, px: 1, ml: -1, color: "text.secondary" }}
          >
            {expanded ? "Show less" : folded.join(" · ")}
          </Button>
          {expanded && paused.length > 0 && (
            <Button
              size="small"
              loading={resume.isPending}
              onClick={resumeAll}
              sx={{ minWidth: 0, px: 1, mr: -1 }}
            >
              Resume all
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
