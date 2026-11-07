"use client";

import { type ReactElement, useState } from "react";
import type {
  PipelineBulkInput,
  PipelineFilters,
  PipelineJobView,
} from "@jobpilot/contracts/pipeline";
import { Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { ListCard, ListHeader, PaginationFooter } from "@/components/ui/data";
import { EmptyState, QuerySection } from "@/components/ui/feedback";
import type { PaginationParams } from "@/hooks/use-pagination";
import { plural } from "@/utils/format";
import { JobDrawer } from "./job-drawer";
import { JobRow } from "./job-row";
import { ReasonBreakdown } from "./reason-breakdown";
import { StaleNotice } from "./stale-notice";

type BulkAction = PipelineBulkInput["action"];

const BULK_LABELS: Record<BulkAction, string> = {
  approve: "Approve",
  skip: "Skip",
  retry: "Retry",
};

const VIEW_ACTIONS: Record<PipelineJobView, BulkAction[]> = {
  review: ["approve", "skip"],
  inProgress: ["skip"],
  notApplied: ["retry"],
  needsYou: [],
};

const EMPTY_TITLES: Record<PipelineJobView, string> = {
  review: "Nothing left to review.",
  inProgress: "Nothing in progress.",
  notApplied: "No skipped or failed jobs.",
  needsYou: "Nothing needs you.",
};

interface JobsViewProps {
  view: PipelineJobView;
  filters: PipelineFilters;
  /** To review jobs found over a month ago, across every page. */
  stale: number;
  pagination: PaginationParams;
}

export function JobsView(props: JobsViewProps): ReactElement {
  const { view, filters, stale, pagination } = props;
  const jobs = useQuery(pipelineQueries.jobs({ ...pagination.query, view, ...filters }));
  const [openId, setOpenId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const rows = jobs.data?.items ?? [];
  const actions = VIEW_ACTIONS[view];
  // A row that left the view after a refetch drops out of the selection.
  const picked = selected.filter((id) => rows.some((job) => job.id === id));
  const allPicked = rows.length > 0 && picked.length === rows.length;
  const sortHint = view === "review" ? "Best match first" : "Latest first";
  // The reason roll-up is per feed, so it shows once a search or feed is picked.
  const reasonsFor = view === "notApplied" ? (filters.feedId ?? null) : null;

  const bulk = useApiMutation((input: PipelineBulkInput) => api.pipeline.jobs.bulk.post(input), {
    invalidate: [pipelineQueries.all],
    successMessage: ({ updated, refused }) => {
      const left = refused > 0 ? ` · ${refused} could no longer change` : "";
      return `Updated ${plural(updated, "job")}${left}.`;
    },
    onSuccess: () => setSelected([]),
  });

  const selection = {
    count: picked.length,
    total: rows.length,
    onToggleAll: () => setSelected(allPicked ? [] : rows.map((job) => job.id)),
  };
  const toggle = (id: string) =>
    setSelected(picked.includes(id) ? picked.filter((other) => other !== id) : [...picked, id]);

  return (
    <Stack spacing={2}>
      {reasonsFor && <ReasonBreakdown feedId={reasonsFor} />}
      {view === "review" && <StaleNotice count={stale} filters={filters} />}
      <QuerySection
        query={jobs}
        errorTitle="Couldn't load these jobs."
        isEmpty={rows.length === 0}
        empty={<EmptyState variant="inline" title={EMPTY_TITLES[view]} />}
      >
        <ListCard
          header={
            <ListHeader
              selection={actions.length > 0 ? selection : null}
              bulkActions={actions.map((action) => (
                <Button
                  key={action}
                  size="small"
                  variant={action === "skip" ? "outlined" : "contained"}
                  disabled={bulk.isPending}
                  onClick={() => bulk.mutate({ action, ids: picked })}
                >
                  {BULK_LABELS[action]}
                </Button>
              ))}
            >
              {sortHint}
            </ListHeader>
          }
          footer={
            jobs.data && (
              <PaginationFooter
                pagination={jobs.data.pagination}
                onPageChange={pagination.setPage}
                onPageSizeChange={pagination.setPageSize}
              />
            )
          }
        >
          {rows.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              view={view}
              showFeed={filters.feedId === undefined}
              selected={actions.length > 0 ? picked.includes(job.id) : null}
              onToggle={() => toggle(job.id)}
              onOpen={() => setOpenId(job.id)}
              onAct={(action) => bulk.mutate({ action, ids: [job.id] })}
            />
          ))}
        </ListCard>
      </QuerySection>
      <JobDrawer
        job={rows.find((job) => job.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </Stack>
  );
}
