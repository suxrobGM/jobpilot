"use client";

import { type ReactElement, useState } from "react";
import type {
  PIPELINE_BULK_ACTIONS,
  PipelineFilters,
  PipelineJobView,
} from "@jobpilot/contracts/pipeline";
import { Button, Stack, Typography } from "@mui/material";
import type { GridRowSelectionModel } from "@mui/x-data-grid";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { gridPagination, type PaginationParams } from "@/hooks/use-pagination";
import { plural } from "@/utils/format";
import { EMPTY_SELECTION, resolveSelectedRows } from "@/utils/grid-selection";
import { JobDrawer } from "./job-drawer";
import { PipelineJobsTable } from "./jobs-table";
import { ReasonBreakdown } from "./reason-breakdown";

type BulkAction = (typeof PIPELINE_BULK_ACTIONS)[number];

const BULK_LABELS: Record<BulkAction, string> = {
  approve: "Approve",
  skip: "Skip",
  retry: "Retry",
};

const VIEW_ACTIONS: Record<PipelineJobView, BulkAction[]> = {
  found: ["approve", "skip"],
  toApply: ["skip"],
  needsYou: [],
  skipped: [],
  failed: ["retry"],
};

interface JobsViewProps {
  view: PipelineJobView;
  filters: PipelineFilters;
  pagination: PaginationParams;
}

export function JobsView(props: JobsViewProps): ReactElement {
  const { view, filters, pagination } = props;
  const jobs = useQuery(pipelineQueries.jobs({ ...pagination.query, view, ...filters }));
  const [openId, setOpenId] = useState<string | null>(null);
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);
  const rows = jobs.data?.items ?? [];
  const actions = VIEW_ACTIONS[view];
  const selected = resolveSelectedRows(selection, rows);
  // The reason roll-up is per feed, so it shows once a search or feed is picked.
  const dropped = view === "skipped" || view === "failed";
  const reasonsFor = dropped ? (filters.feedId ?? null) : null;

  const bulk = useApiMutation(
    (action: BulkAction) =>
      api.pipeline.jobs.bulk.post({ action, ids: selected.map((job) => job.id) }),
    {
      invalidate: [pipelineQueries.all],
      successMessage: ({ updated, refused }) => {
        const left = refused > 0 ? ` · ${refused} could no longer change` : "";
        return `Updated ${plural(updated, "job")}${left}.`;
      },
      onSuccess: () => setSelection(EMPTY_SELECTION),
    },
  );

  return (
    <Stack spacing={2}>
      {reasonsFor && <ReasonBreakdown feedId={reasonsFor} />}
      {selected.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="body2Strong" sx={{ mr: 1 }}>
            {`${selected.length} selected`}
          </Typography>
          {actions.map((action) => (
            <Button
              key={action}
              size="small"
              variant={action === "skip" ? "outlined" : "contained"}
              disabled={bulk.isPending}
              onClick={() => bulk.mutate(action)}
            >
              {BULK_LABELS[action]}
            </Button>
          ))}
        </Stack>
      )}
      <PipelineJobsTable
        view={view}
        rows={rows}
        loading={jobs.isLoading}
        onOpen={(job) => setOpenId(job.id)}
        selection={actions.length > 0 ? selection : null}
        onSelectionChange={setSelection}
        {...gridPagination(pagination, jobs.data?.pagination)}
      />
      <JobDrawer
        job={rows.find((job) => job.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </Stack>
  );
}
