"use client";

import type { ReactElement } from "react";
import { Divider, Stack } from "@mui/material";
import { useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { LinkButton } from "@/components/ui/buttons";
import { EmptyState, QuerySection } from "@/components/ui/data";
import { SectionCard } from "@/components/ui/layout";
import { dedupeById } from "@/utils/array";
import { JournalRow } from "../journal/journal-row";
import { LiveStatusChip } from "../journal/live-status-chip";
import { useJournalLive } from "../journal/use-journal-live";

const RECENT_LIMIT = 8;

/** Compact live strip of the newest journal entries; the Activity tab holds the full feed. */
export function RecentActivity(): ReactElement {
  // Same query key as the Activity tab, so both share one cached first page.
  const firstPage = useApiQuery(pilotQueries.journal());
  const { entries: live, status } = useJournalLive();

  const entries = dedupeById([...live, ...(firstPage.data?.items ?? [])]).slice(0, RECENT_LIMIT);

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
      <QuerySection
        isLoading={firstPage.isLoading}
        isError={firstPage.isError}
        onRetry={() => void firstPage.refetch()}
        errorTitle="Couldn't load the journal."
        isEmpty={entries.length === 0}
        empty={<EmptyState variant="inline" title="No journal entries yet." />}
      >
        <Stack spacing={1.5} divider={<Divider />}>
          {entries.map((entry) => (
            <JournalRow key={entry.id} entry={entry} />
          ))}
        </Stack>
      </QuerySection>
    </SectionCard>
  );
}
