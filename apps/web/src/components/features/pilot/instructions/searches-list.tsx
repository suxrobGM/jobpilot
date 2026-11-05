"use client";

import type { ReactElement } from "react";
import type { PilotSearch } from "@jobpilot/contracts/pilot";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { formatRelativeTime, formatTimeUntil } from "@/utils/format";

/** The empty-run streak that puts a search on the API backoff ladder's top (48h) rung. */
const BACKOFF_THRESHOLD = 3;

interface SearchStatus {
  label: string;
  color: "warning" | "info";
}

function searchStatus(search: PilotSearch): SearchStatus | null {
  if (search.emptyRuns >= BACKOFF_THRESHOLD) {
    return { label: "coming up dry - backing off", color: "warning" };
  }
  if (new Date(search.nextRunAt).getTime() <= Date.now()) {
    return { label: "due now", color: "info" };
  }
  return null;
}

function yieldStats(search: PilotSearch): string {
  const parts: string[] = [];
  if (search.lastRunAt) {
    parts.push(`Last run ${formatRelativeTime(search.lastRunAt)} ago`);
    if (search.lastNewJobs !== null && search.lastJobsScanned !== null) {
      parts.push(`${search.lastNewJobs} new / ${search.lastJobsScanned} seen`);
    }
  } else {
    parts.push("Not run yet");
  }
  // Skip the countdown once due/overdue - the "due now" chip already carries that.
  if (new Date(search.nextRunAt).getTime() > Date.now()) {
    parts.push(`next check ~${formatTimeUntil(search.nextRunAt)}`);
  }
  return parts.join(" · ");
}

interface SearchRowProps {
  search: PilotSearch;
}

function SearchRow(props: SearchRowProps): ReactElement {
  const { search } = props;
  const status = searchStatus(search);

  return (
    <Box>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
      >
        <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
          {search.query}
        </Typography>
        {search.board && <Chip variant="outlined" label={search.board.name} />}
        {status && <Chip color={status.color} label={status.label} />}
      </Stack>
      {search.reason && (
        <Typography variant="captionMuted" sx={{ display: "block", mt: 0.25 }}>
          {search.reason}
        </Typography>
      )}
      <Typography variant="captionMuted" sx={{ display: "block", mt: 0.5 }}>
        {yieldStats(search)}
      </Typography>
    </Box>
  );
}

export function SearchesList(): ReactElement {
  const query = useQuery(pilotQueries.searches());

  const searches = query.data ?? [];

  return (
    <QuerySection
      query={query}
      errorTitle="Couldn't load the pilot's searches."
      isEmpty={searches.length === 0}
      empty={
        <EmptyState variant="inline" title="None yet - the pilot creates these from your goals." />
      }
    >
      <Stack spacing={1.5} divider={<Divider />}>
        {searches.map((search) => (
          <SearchRow key={search.id} search={search} />
        ))}
      </Stack>
    </QuerySection>
  );
}
