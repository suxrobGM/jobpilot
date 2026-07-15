"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotJournalEntry, PilotJournalKind } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  Autorenew,
  Bolt,
  NotificationImportant,
  Summarize,
  Terminal,
  Visibility,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  type ChipProps,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import { api } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { PILOT_JOURNAL_PAGE_SIZE, pilotQueries } from "@/api/queries";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { formatRelativeTime } from "@/utils/format";

const KIND_META: Record<PilotJournalKind, { icon: SvgIconComponent; color: ChipProps["color"] }> = {
  cycle: { icon: Autorenew, color: "primary" },
  action: { icon: Bolt, color: "info" },
  observation: { icon: Visibility, color: "default" },
  escalation: { icon: NotificationImportant, color: "warning" },
  system: { icon: Terminal, color: "default" },
  digest: { icon: Summarize, color: "success" },
};

/** SSE delivers raw JSON, so `createdAt` arrives as an ISO string, not a revived Date. */
function fromEvent(entry: unknown): PilotJournalEntry {
  const raw = entry as PilotJournalEntry & { createdAt: string };
  return { ...raw, createdAt: new Date(raw.createdAt) };
}

/** Cap the live buffer so a long-lived session doesn't grow unbounded; oldest (tail) drop first. */
const LIVE_CAP = 100;

function dedupeById(entries: PilotJournalEntry[]): PilotJournalEntry[] {
  const seen = new Set<string>();
  const out: PilotJournalEntry[] = [];
  for (const entry of entries) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

function JournalRow(props: { entry: PilotJournalEntry }): ReactElement {
  const { entry } = props;
  const meta = KIND_META[entry.kind];
  const Icon = meta.icon;
  return (
    <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
      <Chip
        size="small"
        color={meta.color}
        icon={<Icon fontSize="sm" />}
        label={entry.kind}
        sx={{ textTransform: "capitalize", minWidth: 110 }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2">{entry.summary}</Typography>
      </Box>
      <Typography variant="captionMuted" sx={{ whiteSpace: "nowrap" }}>
        {formatRelativeTime(entry.createdAt)} ago
      </Typography>
    </Stack>
  );
}

export function JournalFeed(): ReactElement {
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
      const { data } = await api.pilot.journal.get({
        query: { cursor: activeCursor, limit: PILOT_JOURNAL_PAGE_SIZE },
      });
      if (data) {
        setOlder((prev) => [...prev, ...data.items]);
        setCursor(data.nextCursor);
      }
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
    <SectionCard title="Journal">
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
