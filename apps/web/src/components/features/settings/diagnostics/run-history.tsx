"use client";

import { type ReactElement, useState } from "react";
import type { PilotRunOutcome } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { Download } from "@mui/icons-material";
import { Box, Chip, Divider, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { API_BASE_URL } from "@/api/base-url";
import { pilotQueries } from "@/api/queries";
import { TooltipIconButton } from "@/components/ui/buttons";
import { PaginationFooter } from "@/components/ui/data";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import { SectionCard } from "@/components/ui/layout";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useSseChannel } from "@/hooks/use-sse-channel";
import { LiveStatusChip } from "./live-status-chip";
import { groupByDay } from "./run-days";
import { OUTCOME_META, OUTCOME_ORDER, RunHistoryRow } from "./run-history-row";

/** A top-level anchor download carries the same-site auth cookie, so no fetch is needed. */
const RUNS_EXPORT_URL = `${API_BASE_URL}/api/pilot/runs/export`;

/** Outcome filters run server-side, so the pager counts only the matching runs. */
export function RunHistory(): ReactElement {
  const [selected, setSelected] = useState<PilotRunOutcome[]>([]);
  const pagination = usePaginationParams({ prefix: "runs" });
  const history = useQuery(pilotQueries.runHistory(selected, pagination.query));
  // The shared pilot stream, so this opens no second connection.
  const status = useSseChannel(pilotChannel, null);

  const toggle = (outcome: PilotRunOutcome): void => {
    setSelected((prev) =>
      prev.includes(outcome) ? prev.filter((o) => o !== outcome) : [...prev, outcome],
    );
    pagination.setPage(1);
  };

  const runs = history.data?.items ?? [];
  const emptyMessage =
    selected.length > 0 ? "No runs match the selected filters." : "No finished runs yet.";

  return (
    <SectionCard
      title="Run history"
      actions={
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <LiveStatusChip status={status} />
          <TooltipIconButton
            title="Export the run history"
            href={RUNS_EXPORT_URL}
            download="pilot-runs.ndjson"
          >
            <Download fontSize="sm" />
          </TooltipIconButton>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
          {OUTCOME_ORDER.map((outcome) => {
            const isSelected = selected.includes(outcome);
            return (
              <Chip
                key={outcome}
                label={OUTCOME_META[outcome].label}
                color={isSelected ? OUTCOME_META[outcome].color : "default"}
                variant={isSelected ? "filled" : "outlined"}
                onClick={() => toggle(outcome)}
              />
            );
          })}
        </Stack>
        <QuerySection
          query={history}
          errorTitle="Couldn't load the run history."
          isEmpty={runs.length === 0}
          empty={<EmptyState variant="inline" title={emptyMessage} />}
        >
          <Stack spacing={3}>
            {groupByDay(runs).map((day) => (
              <Box key={day.key}>
                <Typography variant="overlineMuted" sx={{ display: "block", mb: 1.5 }}>
                  {day.label}
                </Typography>
                <Stack spacing={1.5} divider={<Divider />}>
                  {day.runs.map((run) => (
                    <RunHistoryRow key={run.id} run={run} />
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        </QuerySection>
        {history.data && (
          <PaginationFooter
            pagination={history.data.pagination}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        )}
      </Stack>
    </SectionCard>
  );
}
