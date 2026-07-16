"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotJournalEntry, PilotJournalKind } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import type { SvgIconComponent } from "@mui/icons-material";
import {
  Autorenew,
  Bolt,
  Download,
  NotificationImportant,
  Rule,
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
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { useApiQuery } from "@/api/hooks";
import { PILOT_JOURNAL_PAGE_SIZE, pilotQueries } from "@/api/queries";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { useToast } from "@/providers/notification-provider";
import { formatRelativeTime } from "@/utils/format";

const KIND_META: Record<PilotJournalKind, { icon: SvgIconComponent; color: ChipProps["color"] }> = {
  cycle: { icon: Autorenew, color: "primary" },
  action: { icon: Bolt, color: "info" },
  observation: { icon: Visibility, color: "default" },
  question: { icon: NotificationImportant, color: "warning" },
  system: { icon: Terminal, color: "default" },
  digest: { icon: Summarize, color: "success" },
  correction: { icon: Rule, color: "secondary" },
};

/** Same-site cookie rides a top-level anchor download, so no fetch/token handling is needed here. */
const JOURNAL_EXPORT_URL = `${API_BASE_URL}/api/pilot/journal/export`;

const n = (detail: Record<string, unknown>, key: string): number =>
  typeof detail[key] === "number" ? (detail[key] as number) : 0;

/** Glanceable counts from a digest entry's 24h detail, mirroring the summary's fields. */
function DigestCounts(props: { detail: Record<string, unknown> }): ReactElement {
  const { detail } = props;
  const parts = [
    `${n(detail, "applicationsCreated")} applied`,
    `${n(detail, "jobsFailed") + n(detail, "jobsSkipped")} not applied`,
    `${n(detail, "outreachSent")} outreach (${n(detail, "outreachReplies")} replies)`,
    `${n(detail, "promotionsPosted")} posts`,
    `${n(detail, "openQuestions")} open`,
  ];
  return <Typography variant="captionMuted">{parts.join(" · ")}</Typography>;
}

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
        {entry.kind === "digest" && <DigestCounts detail={entry.detail} />}
      </Box>
      <Typography variant="captionMuted" sx={{ whiteSpace: "nowrap" }}>
        {formatRelativeTime(entry.createdAt)} ago
      </Typography>
    </Stack>
  );
}

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
