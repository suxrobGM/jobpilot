"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import type { PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { SectionCard } from "@/components/ui/layout";
import { useSseChannel } from "@/lib/sse/client";
import { dedupeById, fromEvent, JournalRow, LIVE_CAP } from "./journal-row";
import { LiveStatusChip } from "./live-status-chip";

const RECENT_LIMIT = 8;

/** Compact live strip of the newest journal entries; the Activity tab holds the full feed. */
export function RecentActivity(): ReactElement {
  // Same query key as the Activity tab, so both share one cached first page.
  const firstPage = useApiQuery(pilotQueries.journal());
  const [live, setLive] = useState<PilotJournalEntry[]>([]);

  const status = useSseChannel(pilotChannel, null, {
    on: {
      "journal.appended": (event) => {
        setLive((prev) => [fromEvent(event.entry), ...prev].slice(0, LIVE_CAP));
      },
    },
  });

  const entries = dedupeById([...live, ...(firstPage.data?.items ?? [])]).slice(0, RECENT_LIMIT);

  let body: ReactNode;
  if (firstPage.isLoading) {
    body = <LinearProgress />;
  } else if (entries.length === 0) {
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
      title="Recent activity"
      actions={
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <LiveStatusChip status={status} />
          <LinkButton size="small" href="/pilot/activity">
            View all
          </LinkButton>
        </Stack>
      }
    >
      {body}
    </SectionCard>
  );
}
