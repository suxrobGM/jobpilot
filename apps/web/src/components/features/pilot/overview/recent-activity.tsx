"use client";

import type { ReactElement, ReactNode } from "react";
import { Divider, LinearProgress, Stack } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { dedupeById, JournalRow } from "../journal/journal-row";
import { LiveStatusChip } from "../journal/live-status-chip";
import { useJournalLive } from "../journal/use-journal-live";

const RECENT_LIMIT = 8;

/** Compact live strip of the newest journal entries; the Activity tab holds the full feed. */
export function RecentActivity(): ReactElement {
  // Same query key as the Activity tab, so both share one cached first page.
  const firstPage = useApiQuery(pilotQueries.journal());
  const { entries: live, status } = useJournalLive();

  const entries = dedupeById([...live, ...(firstPage.data?.items ?? [])]).slice(0, RECENT_LIMIT);

  let body: ReactNode;
  if (firstPage.isLoading) {
    body = <LinearProgress />;
  } else if (entries.length === 0) {
    body = <EmptyState variant="inline" title="No journal entries yet." />;
  } else {
    body = (
      <Stack spacing={1.5} divider={<Divider />}>
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
