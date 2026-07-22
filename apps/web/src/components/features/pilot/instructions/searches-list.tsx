"use client";

import type { ReactElement } from "react";
import type { PilotSearch } from "@jobpilot/contracts/pilot";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { EmptyState, QuerySection } from "@/components/ui/data";
import { formatRelativeTime, formatTimeUntil } from "@/utils/format";

// Consecutive empty runs at which the pilot starts backing a search off (see contracts/pilot/search).
const BACKOFF_THRESHOLD = 3;

interface SearchStatus {
  label: string;
  color: "warning" | "info";
}

/** The one status worth flagging on a row, or null when the search is on its normal cadence. */
function searchStatus(search: PilotSearch): SearchStatus | null {
  if (search.emptyRuns >= BACKOFF_THRESHOLD) {
    return { label: "coming up dry — backing off", color: "warning" };
  }
  if (new Date(search.nextRunAt).getTime() <= Date.now()) {
    return { label: "due now", color: "info" };
  }
  return null;
}

/** Compact yield line: last run, this-run yield, and the next scheduled check. */
function yieldStats(search: PilotSearch): string {
  const parts: string[] = [];
  if (search.lastRunAt) {
    parts.push(`Last run ${formatRelativeTime(search.lastRunAt)} ago`);
    if (search.lastNewJobs !== null && search.lastJobsSeen !== null) {
      parts.push(`${search.lastNewJobs} new / ${search.lastJobsSeen} seen`);
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
        {search.board && <Chip size="small" variant="outlined" label={search.board} />}
        {status && <Chip size="small" color={status.color} label={status.label} />}
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

/** Read-only list of the pilot's self-managed discovery searches - no add/edit/delete controls. */
export function SearchesList(): ReactElement {
  const query = useApiQuery(pilotQueries.searches(), {
    errorMessage: "Failed to load pilot searches",
  });

  const searches = query.data ?? [];

  return (
    <QuerySection
      isLoading={query.isLoading}
      isError={query.isError}
      onRetry={() => void query.refetch()}
      errorTitle="Couldn't load the pilot's searches."
      isEmpty={searches.length === 0}
      empty={
        <EmptyState variant="inline" title="None yet — the pilot creates these from your goals." />
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
