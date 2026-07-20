"use client";

import { type ReactElement, useState } from "react";
import type { PilotJournalEntry, PilotJournalKind } from "@jobpilot/contracts/pilot";
import { Download } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Divider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { PILOT_JOURNAL_PAGE_SIZE, pilotQueries } from "@/api/queries";
import { EmptyState, QuerySection } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { useToast } from "@/providers/notification-provider";
import { dedupeById } from "@/utils/array";
import { CycleTimeline } from "./cycle-timeline";
import { JournalRow, KIND_META, KIND_ORDER } from "./journal-row";
import { LiveStatusChip } from "./live-status-chip";
import { useJournalLive } from "./use-journal-live";

/** Same-site cookie rides a top-level anchor download, so no fetch/token handling is needed here. */
const JOURNAL_EXPORT_URL = `${API_BASE_URL}/api/pilot/journal/export`;

/** Full journal feed with client-side kind filters; the server has no kind query param. */
export function JournalFeed(): ReactElement {
  const toast = useToast();
  const firstPage = useApiQuery(pilotQueries.journal());
  const { entries: live, status } = useJournalLive();
  const [older, setOlder] = useState<PilotJournalEntry[]>([]);
  // `undefined` means paging hasn't started, so fall back to the first page's cursor.
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState<PilotJournalKind[]>([]);
  const [view, setView] = useState<"flat" | "cycle">("flat");

  const activeCursor = cursor === undefined ? (firstPage.data?.nextCursor ?? null) : cursor;

  const loadMore = async (): Promise<void> => {
    if (!activeCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const { data, error } = await api.pilot.journal.get({
        query: { cursor: activeCursor, limit: PILOT_JOURNAL_PAGE_SIZE },
      });
      if (error || !data) {
        toast.error("Couldn't load more journal entries.");
        return;
      }
      setOlder((prev) => [...prev, ...data.items]);
      setCursor(data.nextCursor);
    } catch {
      toast.error("Couldn't load more journal entries.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleKind = (kind: PilotJournalKind): void => {
    setSelectedKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );
  };

  const entries = dedupeById([...live, ...(firstPage.data?.items ?? []), ...older]);
  const visible =
    selectedKinds.length === 0 ? entries : entries.filter((e) => selectedKinds.includes(e.kind));

  const emptyMessage =
    entries.length === 0 ? "No journal entries yet." : "No entries match the selected filters.";

  return (
    <SectionCard
      title="Journal"
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <LiveStatusChip status={status} />
          <Button
            size="small"
            startIcon={<Download fontSize="sm" />}
            component="a"
            href={JOURNAL_EXPORT_URL}
            download="pilot-journal.ndjson"
          >
            Export
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Stack spacing={0.75}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
            {KIND_ORDER.map((kind) => {
              const selected = selectedKinds.includes(kind);
              return (
                <Chip
                  key={kind}
                  size="small"
                  label={KIND_META[kind].label}
                  color={selected ? KIND_META[kind].color : "default"}
                  variant={selected ? "filled" : "outlined"}
                  onClick={() => toggleKind(kind)}
                />
              );
            })}
          </Stack>
          {selectedKinds.length > 0 && (
            <Typography variant="captionMuted">
              Filters apply to loaded entries - Load more fetches all kinds.
            </Typography>
          )}
        </Stack>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_e, next) => next && setView(next)}
          aria-label="Journal view"
        >
          <ToggleButton value="flat">Flat feed</ToggleButton>
          <ToggleButton value="cycle">By cycle</ToggleButton>
        </ToggleButtonGroup>
        <QuerySection
          isLoading={firstPage.isLoading}
          isError={firstPage.isError}
          onRetry={() => void firstPage.refetch()}
          errorTitle="Couldn't load the journal."
          isEmpty={visible.length === 0}
          empty={<EmptyState variant="inline" title={emptyMessage} />}
        >
          {view === "cycle" ? (
            <CycleTimeline entries={visible} />
          ) : (
            <Stack spacing={1.5} divider={<Divider />}>
              {visible.map((entry) => (
                <JournalRow key={entry.id} entry={entry} />
              ))}
            </Stack>
          )}
        </QuerySection>
        {activeCursor && (
          <Box>
            <Button variant="text" disabled={loadingMore} onClick={() => loadMore()}>
              Load more
            </Button>
          </Box>
        )}
      </Stack>
    </SectionCard>
  );
}
