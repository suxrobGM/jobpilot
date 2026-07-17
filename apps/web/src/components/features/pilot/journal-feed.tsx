"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Download } from "@mui/icons-material";
import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { PILOT_JOURNAL_PAGE_SIZE, pilotQueries } from "@/api/queries";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { useToast } from "@/providers/notification-provider";
import { dedupeById, fromEvent, JournalRow, LIVE_CAP } from "./journal-row";

/** Same-site cookie rides a top-level anchor download, so no fetch/token handling is needed here. */
const JOURNAL_EXPORT_URL = `${API_BASE_URL}/api/pilot/journal/export`;

export function JournalFeed(): ReactElement {
  const toast = useToast();
  const firstPage = useApiQuery(pilotQueries.journal());
  const [live, setLive] = useState<PilotJournalEntry[]>([]);
  const [older, setOlder] = useState<PilotJournalEntry[]>([]);
  // `undefined` means paging hasn't started, so fall back to the first page's cursor.
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);

  useSseChannel(pilotChannel, null, {
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

  if (firstPage.isLoading) {
    return (
      <SectionCard title="Journal">
        <LinearProgress />
      </SectionCard>
    );
  }

  const entries = dedupeById([...live, ...(firstPage.data?.items ?? []), ...older]);

  let body: ReactNode;
  if (entries.length === 0) {
    body = <Typography variant="body2Muted">No journal entries yet.</Typography>;
  } else {
    body = (
      <Stack spacing={1.5} divider={<Box sx={{ borderTop: 1, borderColor: "divider" }} />}>
        {entries.map((entry) => (
          <JournalRow key={entry.id} entry={entry} />
        ))}
      </Stack>
    );
  }

  return (
    <SectionCard
      title="Journal"
      actions={
        <Button
          size="small"
          startIcon={<Download fontSize="sm" />}
          component="a"
          href={JOURNAL_EXPORT_URL}
          download="pilot-journal.ndjson"
        >
          Export
        </Button>
      }
    >
      <Stack spacing={2}>
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
