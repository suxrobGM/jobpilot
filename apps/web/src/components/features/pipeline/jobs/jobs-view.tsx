"use client";

import { type ReactElement, useState } from "react";
import type { PipelineBulkInput, PipelineJobView } from "@jobpilot/contracts/pipeline";
import { Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { ListHeader, PagedList } from "@/components/ui/data";
import { EmptyState } from "@/components/ui/feedback";
import { usePaginationParams } from "@/hooks/use-pagination";
import { useRowSelection } from "@/hooks/use-row-selection";
import { plural } from "@/utils/format";
import { usePipelineFilters } from "../pipeline-filters";
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
  needsYou: ["skip"],
};

const EMPTY_TITLES: Record<PipelineJobView, string> = {
  review: "Nothing left to review.",
  inProgress: "Nothing in progress.",
  notApplied: "No skipped or failed jobs.",
  needsYou: "Nothing needs you.",
};

interface JobsViewProps {
  view: PipelineJobView;
}

export function JobsView(props: JobsViewProps): ReactElement {
  const { view } = props;
  const filters = usePipelineFilters();
  const pagination = usePaginationParams();
  const jobs = useQuery(pipelineQueries.jobs({ ...pagination.query, view, ...filters }));
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = jobs.data?.items ?? [];
  const selection = useRowSelection(rows);
  const actions = VIEW_ACTIONS[view];
  const picked = selection.picked.map((job) => job.id);
  const sortHint = view === "review" ? "Best match first" : "Latest first";
  // The reason roll-up is per feed, so it shows once a search or feed is picked.
  const reasonsFor = view === "notApplied" ? (filters.feedId ?? null) : null;

  const bulk = useApiMutation((input: PipelineBulkInput) => api.pipeline.jobs.bulk.post(input), {
    invalidate: [pipelineQueries.all],
    successMessage: ({ updated, refused }) => {
      const left = refused > 0 ? ` · ${refused} could no longer change` : "";
      return `Updated ${plural(updated, "job")}${left}.`;
    },
    onSuccess: selection.clear,
  });

  return (
    <Stack spacing={2}>
      {reasonsFor && <ReasonBreakdown feedId={reasonsFor} />}
      {view === "review" && <StaleNotice />}
      <PagedList
        query={jobs}
        pager={pagination}
        isEmpty={rows.length === 0}
        errorTitle="Couldn't load these jobs."
        empty={<EmptyState variant="inline" title={EMPTY_TITLES[view]} />}
        header={
          <ListHeader
            selection={actions.length > 0 ? selection.header : null}
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
      >
        {rows.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            view={view}
            showFeed={filters.feedId === undefined}
            selection={actions.length > 0 ? selection.row(job, job.title) : null}
            onOpen={() => setOpenId(job.id)}
            onAct={(action) => bulk.mutate({ action, ids: [job.id] })}
          />
        ))}
      </PagedList>
      <JobDrawer
        job={rows.find((job) => job.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </Stack>
  );
}
