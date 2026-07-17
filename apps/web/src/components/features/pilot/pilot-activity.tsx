"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotJournalEntry, PilotJournalKind } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Download } from "@mui/icons-material";
import { Box, Button, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { PILOT_JOURNAL_PAGE_SIZE, pilotQueries } from "@/api/queries";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { useToast } from "@/providers/notification-provider";
import { dedupeById, fromEvent, JournalRow, KIND_META, LIVE_CAP } from "./journal-row";
import { LiveStatusChip } from "./live-status-chip";

/** Same-site cookie rides a top-level anchor download, so no fetch/token handling is needed here. */
const JOURNAL_EXPORT_URL = `${API_BASE_URL}/api/pilot/journal/export`;

const ALL_KINDS = Object.keys(KIND_META) as PilotJournalKind[];

/** Full journal feed with client-side kind filters; the server has no kind query param. */
export function PilotActivity(): ReactElement {
  const toast = useToast();
  const firstPage = useApiQuery(pilotQueries.journal());
  const [live, setLive] = useState<PilotJournalEntry[]>([]);
  const [older, setOlder] = useState<PilotJournalEntry[]>([]);
  // `undefined` means paging hasn't started, so fall back to the first page's cursor.
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedKinds, setSelectedKinds] = useState<PilotJournalKind[]>([]);

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "journal.appended": (event) => {
        setLive((prev) => [fromEvent(event.entry), ...prev].slice(0, LIVE_CAP));
      },
    },
  });

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

  if (firstPage.isLoading) {
    return (
      <SectionCard title="Journal">
        <LinearProgress />
      </SectionCard>
    );
  }

  const entries = dedupeById([...live, ...(firstPage.data?.items ?? []), ...older]);
  const visible =
    selectedKinds.length === 0 ? entries : entries.filter((e) => selectedKinds.includes(e.kind));

  let body: ReactNode;
  if (entries.length === 0) {
    body = <Typography variant="body2Muted">No journal entries yet.</Typography>;
  } else if (visible.length === 0) {
    body = <Typography variant="body2Muted">No entries match the selected filters.</Typography>;
  } else {
    body = (
      <Stack spacing={1.5} divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
        {visible.map((entry) => (
          <JournalRow key={entry.id} entry={entry} />
        ))}
      </Stack>
    );
  }

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
            {ALL_KINDS.map((kind) => {
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
              Filters apply to loaded entries — Load more fetches all kinds.
            </Typography>
          )}
        </Stack>
        {body}
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
