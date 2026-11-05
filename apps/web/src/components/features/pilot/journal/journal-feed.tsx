"use client";

import { type ReactElement, useState } from "react";
import { DEFAULT_CURSOR_PAGE_SIZE } from "@jobpilot/contracts/pagination";
import type { PilotJournalKind, PilotJournalPage } from "@jobpilot/contracts/pilot";
import { DeleteSweep, Download, MoreVert } from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from "@mui/material";
import { API_BASE_URL } from "@/api/base-url";
import { api } from "@/api/client";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { pilotQueries } from "@/api/queries";
import { queryKeys } from "@/api/query-keys";
import { EmptyState, QuerySection } from "@/components/ui/data";
import { DropdownMenu } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { useConfirm } from "@/providers/confirm-provider";
import { useToast } from "@/providers/notification-provider";
import { dedupeById } from "@/utils/array";
import { CycleTimeline } from "./cycle-timeline";
import { collapseCoveredCycles, groupByDay, withLatestRuns } from "./journal-entries";
import { JournalRow, KIND_META, KIND_ORDER } from "./journal-row";
import { LiveStatusChip } from "./live-status-chip";
import { useJournalLiveStatus } from "./use-journal-live";

/** A top-level anchor download carries the same-site auth cookie, so no fetch is needed. */
const JOURNAL_EXPORT_URL = `${API_BASE_URL}/api/pilot/journal/export`;

/** Kind filters run server-side, so paging under a filter stays on one stream. */
export function JournalFeed(): ReactElement {
  const toast = useToast();
  const confirm = useConfirm();
  const [selectedKinds, setSelectedKinds] = useState<PilotJournalKind[]>([]);
  const firstPage = useApiQuery(pilotQueries.journal(selectedKinds));
  const status = useJournalLiveStatus();
  // Whole pages, so the resume cursor is simply the last page's.
  const [pages, setPages] = useState<PilotJournalPage[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [view, setView] = useState<"flat" | "cycle">("flat");

  const reset = useApiMutation(() => api.pilot.runs.delete(), {
    successMessage: "Pilot reset",
    invalidate: [queryKeys.pilot.all],
    onSuccess: () => setPages([]),
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

  const lastPage = pages.at(-1);
  const activeCursor = lastPage ? lastPage.nextCursor : (firstPage.data?.nextCursor ?? null);

  const loadMore = async (): Promise<void> => {
    if (!activeCursor) {
      return;
    }
    setLoadingMore(true);
    try {
      const { data, error } = await api.pilot.journal.get({
        query: {
          cursor: activeCursor,
          limit: DEFAULT_CURSOR_PAGE_SIZE,
          ...(selectedKinds.length > 0 ? { kinds: selectedKinds } : {}),
        },
      });
      if (error || !data) {
        toast.error("Couldn't load more journal entries.");
        return;
      }
      setPages((prev) => [...prev, data]);
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
    // Older pages came off the previous filter's stream; its cursors don't carry over.
    setPages([]);
  };

  // Live prepends keep the first page's tail, which the first older page repeats.
  const older = pages.flatMap((page) => page.items);
  const entries = withLatestRuns(dedupeById([...(firstPage.data?.items ?? []), ...older]));
  const visible = view === "flat" ? collapseCoveredCycles(entries) : entries;

  const emptyMessage =
    selectedKinds.length > 0 ? "No entries match the selected filters." : "No journal entries yet.";

  return (
    <SectionCard
      title="Journal"
      actions={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <LiveStatusChip status={status} />
          <Tooltip title="Export the journal">
            <IconButton
              component="a"
              href={JOURNAL_EXPORT_URL}
              download="pilot-journal.ndjson"
              aria-label="Export the journal"
            >
              <Download fontSize="sm" />
            </IconButton>
          </Tooltip>
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
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
        >
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
          <ToggleButtonGroup
            exclusive
            size="small"
            value={view}
            onChange={(_e, next) => next && setView(next)}
            aria-label="Journal view"
          >
            <ToggleButton value="flat">By day</ToggleButton>
            <ToggleButton value="cycle">By cycle</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
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
            <Stack spacing={3}>
              {groupByDay(visible).map((day) => (
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
