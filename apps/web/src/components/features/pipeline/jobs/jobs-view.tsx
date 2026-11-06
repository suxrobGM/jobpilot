"use client";

import { type ReactElement, useState } from "react";
import type { PipelineFilters, PipelineJobView } from "@jobpilot/contracts/pipeline";
import { Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { pipelineQueries } from "@/api/queries";
import { gridPagination, type PaginationParams } from "@/hooks/use-pagination";
import { JobDrawer } from "./job-drawer";
import { PipelineJobsTable } from "./jobs-table";
import { ReasonBreakdown } from "./reason-breakdown";

interface JobsViewProps {
  view: PipelineJobView;
  filters: PipelineFilters;
  pagination: PaginationParams;
}

export function JobsView(props: JobsViewProps): ReactElement {
  const { view, filters, pagination } = props;
  const jobs = useQuery(pipelineQueries.jobs({ ...pagination.query, view, ...filters }));
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = jobs.data?.items ?? [];
  // The reason roll-up is per feed, so it shows once a search or feed is picked.
  const dropped = view === "skipped" || view === "failed";
  const reasonsFor = dropped ? (filters.feedId ?? null) : null;

  return (
    <Stack spacing={2}>
      {reasonsFor && <ReasonBreakdown feedId={reasonsFor} />}
      <PipelineJobsTable
        view={view}
        rows={rows}
        loading={jobs.isLoading}
        onOpen={(job) => setOpenId(job.id)}
        {...gridPagination(pagination, jobs.data?.pagination)}
      />
      <JobDrawer
        job={rows.find((job) => job.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </Stack>
  );
}
