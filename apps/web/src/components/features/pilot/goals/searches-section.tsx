"use client";

import { type ReactElement, useState } from "react";
import { Delete, ExpandLess, ExpandMore, Pause, PlayArrow } from "@mui/icons-material";
import { Box, Chip, Collapse, Divider, IconButton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pilotQueries } from "@/api/queries";
import type { FeedDto } from "@/api/types";
import { TooltipIconButton } from "@/components/ui/buttons";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { useConfirm } from "@/providers/confirm-provider";
import { formatRelativeTime, formatTimeUntil } from "@/utils/format";
import { useMakeChange } from "../changes/use-changes";
import { useRotationNames } from "../use-rotation-names";
import { SearchBoardSelect } from "./search-board-select";

/** The empty-run streak that puts a search on the API backoff ladder's top (48h) rung. */
const BACKOFF_THRESHOLD = 3;

/** Where the next run goes: the pinned board, or the checked boards in turn. */
function boardLabel(search: FeedDto, rotation: string[]): string {
  if (search.board) {
    return `Pinned to ${search.board.name}`;
  }
  return rotation.length > 0 ? `Rotates ${rotation.join(", ")}` : "No board checked";
}

function yieldStats(search: FeedDto): string {
  const parts = [`${search.appliedThisWeek} applied this week`];
  if (search.lastRunAt) {
    parts.push(`last run ${formatRelativeTime(search.lastRunAt)} ago`);
    if (search.lastNewJobs !== null && search.lastJobsScanned !== null) {
      parts.push(`${search.lastNewJobs} new of ${search.lastJobsScanned} seen`);
    }
  } else {
    parts.push("not run yet");
  }
  if (search.pausedAt === null && new Date(search.nextRunAt).getTime() > Date.now()) {
    parts.push(`next check in ${formatTimeUntil(search.nextRunAt)}`);
  }
  return parts.join(" · ");
}

interface SearchRowProps {
  search: FeedDto;
  rotation: string[];
}

function SearchRow(props: SearchRowProps): ReactElement {
  const { search, rotation } = props;
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const change = useMakeChange();
  const backingOff = search.emptyRuns >= BACKOFF_THRESHOLD;
  const paused = search.pausedAt !== null;

  const togglePause = (): void => {
    const type = paused ? "search.resume" : "search.pause";
    const verb = paused ? "Resumed" : "Paused";
    change.mutate({ summary: `${verb} ${search.name}`, actions: [{ type, searchId: search.id }] });
  };

  const remove = async (): Promise<void> => {
    const ok = await confirm({
      title: `Delete "${search.name}"?`,
      description: "The pilot stops running it. Jobs it already found stay in your pipeline.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) {
      change.mutate({
        summary: `Deleted ${search.name}`,
        actions: [{ type: "search.delete", searchId: search.id }],
      });
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <IconButton
          size="small"
          aria-label={open ? "Hide details" : "Show details"}
          onClick={() => setOpen(!open)}
        >
          {open ? <ExpandLess fontSize="sm" /> : <ExpandMore fontSize="sm" />}
        </IconButton>
        <Typography variant="body2Strong" noWrap sx={{ flex: 1, minWidth: 0 }}>
          {search.name}
        </Typography>
        {paused && <Chip label="Paused" />}
        {!paused && backingOff && <Chip color="warning" label="Coming up dry" />}
        <TooltipIconButton
          title={paused ? "Resume" : "Pause"}
          size="small"
          disabled={change.isPending}
          onClick={togglePause}
        >
          {paused ? <PlayArrow fontSize="sm" /> : <Pause fontSize="sm" />}
        </TooltipIconButton>
        <TooltipIconButton
          title="Delete"
          size="small"
          disabled={change.isPending}
          onClick={() => void remove()}
        >
          <Delete fontSize="sm" />
        </TooltipIconButton>
      </Stack>
      <Typography variant="captionMuted" sx={{ display: "block", pl: 5 }}>
        {`${boardLabel(search, rotation)} · ${yieldStats(search)}`}
      </Typography>
      <Collapse in={open} unmountOnExit>
        <Stack spacing={1} sx={{ pl: 5, pt: 1 }}>
          <Typography variant="body2">Query: {search.query}</Typography>
          {search.reason && <Typography variant="captionMuted">{search.reason}</Typography>}
          <SearchBoardSelect search={search} />
        </Stack>
      </Collapse>
    </Box>
  );
}

export function SearchesSection(): ReactElement {
  const query = useQuery(pilotQueries.searches());
  const searches = query.data ?? [];
  const rotation = useRotationNames();

  return (
    <QuerySection
      query={query}
      errorTitle="Couldn't load the pilot's searches."
      isEmpty={searches.length === 0}
      empty={
        <EmptyState variant="inline" title="None yet. The pilot builds these from your goals." />
      }
    >
      <Stack spacing={1.5} divider={<Divider />}>
        {searches.map((search) => (
          <SearchRow key={search.id} search={search} rotation={rotation} />
        ))}
      </Stack>
    </QuerySection>
  );
}
