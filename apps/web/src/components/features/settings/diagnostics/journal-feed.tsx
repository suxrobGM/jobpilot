"use client";

import { type ReactElement, useState } from "react";
import type { PilotJournalKind } from "@jobpilot/contracts/pilot";
import { DeleteSweep, Download, MoreVert } from "@mui/icons-material";
import { Box, Chip, Divider, IconButton, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { pilotQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { TooltipIconButton } from "@/components/ui/buttons";
import { PaginationFooter } from "@/components/ui/data";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { DropdownMenu } from "@/components/ui/navigation";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useConfirm } from "@/providers/confirm-provider";
import { useJournalLiveStatus } from "../../pilot/journal/journal-cache";
import { JournalRow, KIND_META, KIND_ORDER } from "../../pilot/journal/journal-row";
import { groupByDay, withLatestRuns } from "./journal-entries";
import { LiveStatusChip } from "./live-status-chip";

/** A top-level anchor download carries the same-site auth cookie, so no fetch is needed. */
const JOURNAL_EXPORT_URL = `${API_BASE_URL}/api/pilot/journal/export`;

/** Kind filters run server-side, so the pager counts only the matching entries. */
export function JournalFeed(): ReactElement {
  const confirm = useConfirm();
  const [selectedKinds, setSelectedKinds] = useState<PilotJournalKind[]>([]);
  const pagination = usePaginationParams({ prefix: "journal" });
  const feed = useQuery(pilotQueries.journalPage(selectedKinds, pagination.query));
  const status = useJournalLiveStatus();

  const reset = useApiMutation(() => api.pilot.runs.delete(), {
    successMessage: "Pilot reset",
    // Reset also drops the server's task list, so every pilot read is stale.
    invalidate: [pilotQueries.all],
  });

  const resetWithConfirm = async (): Promise<void> => {
    const ok = await confirm({
      title: "Reset the pilot?",
      description:
        "Deletes every journal entry and sets cycles run back to 0. Your instructions and searches stay, and a running pilot keeps running.",
      confirmLabel: "Reset",
      destructive: true,
    });
    if (ok) {
      reset.mutate(undefined);
    }
  };

  const toggleKind = (kind: PilotJournalKind): void => {
    setSelectedKinds((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind],
    );
    pagination.setPage(1);
  };

  const entries = withLatestRuns(feed.data?.items ?? []);

  const emptyMessage =
    selectedKinds.length > 0 ? "No entries match the selected filters." : "No journal entries yet.";

  return (
    <SectionCard
      title="Journal"
      actions={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <LiveStatusChip status={status} />
          <TooltipIconButton
            title="Export the journal"
            href={JOURNAL_EXPORT_URL}
            download="pilot-journal.ndjson"
          >
            <Download fontSize="sm" />
          </TooltipIconButton>
          <DropdownMenu
            trigger={({ onOpen }) => (
              <IconButton aria-label="More journal actions" onClick={onOpen}>
                <MoreVert fontSize="sm" />
              </IconButton>
            )}
            items={[
              {
                kind: "item",
                key: "reset",
                label: "Reset pilot…",
                icon: <DeleteSweep fontSize="sm" />,
                danger: true,
                disabled: reset.isPending,
                onClick: () => void resetWithConfirm(),
              },
            ]}
          />
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {KIND_ORDER.map((kind) => {
            const selected = selectedKinds.includes(kind);
            return (
              <Chip
                key={kind}
                label={KIND_META[kind].label}
                color={selected ? KIND_META[kind].color : "default"}
                variant={selected ? "filled" : "outlined"}
                onClick={() => toggleKind(kind)}
              />
            );
          })}
        </Stack>
        <QuerySection
          query={feed}
          errorTitle="Couldn't load the journal."
          isEmpty={entries.length === 0}
          empty={<EmptyState variant="inline" title={emptyMessage} />}
        >
          <Stack spacing={3}>
            {groupByDay(entries).map((day) => (
              <Box key={day.key}>
                <Typography variant="overlineMuted" sx={{ display: "block", mb: 1.5 }}>
                  {day.label}
                </Typography>
                <Stack spacing={1.5} divider={<Divider />}>
                  {day.entries.map((entry) => (
                    <JournalRow key={entry.id} entry={entry} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </QuerySection>
        {feed.data && (
          <PaginationFooter
            pagination={feed.data.pagination}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </Stack>
    </SectionCard>
  );
}
