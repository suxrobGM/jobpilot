"use client";

import { type ReactElement, useState } from "react";
import type {
  PipelineBulkInput,
  PipelineFilters,
  PipelineJobView,
} from "@jobpilot/contracts/pipeline";
import { Box, Button, Checkbox, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { pipelineQueries } from "@/api/queries";
import { useApiMutation } from "@/api/use-api-mutation";
import { PaginationFooter } from "@/components/ui/data";
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
  setAside: ["retry"],
  needsYou: [],
};

const EMPTY_TITLES: Record<PipelineJobView, string> = {
  review: "Nothing left to review.",
  inProgress: "Nothing in progress.",
  setAside: "Nothing set aside.",
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
  const reasonsFor = view === "setAside" ? (filters.feedId ?? null) : null;

  const bulk = useApiMutation((input: PipelineBulkInput) => api.pipeline.jobs.bulk.post(input), {
    invalidate: [pipelineQueries.all],
    successMessage: ({ updated, refused }) => {
      const left = refused > 0 ? ` · ${refused} could no longer change` : "";
      return `Updated ${plural(updated, "job")}${left}.`;
    },
    onSuccess: () => setSelected([]),
  });

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
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
          {actions.length > 0 && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                px: 2,
                py: 1,
                minHeight: 48,
                alignItems: "center",
                borderBottom: 1,
                borderColor: "divider",
                bgcolor: "surfaces.elevated",
              }}
            >
              <Checkbox
                size="small"
                checked={allPicked}
                indeterminate={picked.length > 0 && !allPicked}
                onChange={() => setSelected(allPicked ? [] : rows.map((job) => job.id))}
                slotProps={{ input: { "aria-label": "Select all on this page" } }}
                sx={{ p: 0, mr: 1 }}
              />
              {picked.length === 0 ? (
                <Typography variant="captionMuted">{sortHint}</Typography>
              ) : (
                <>
                  <Typography variant="body2Strong" sx={{ mr: 1 }}>
                    {`${picked.length} selected`}
                  </Typography>
                  {actions.map((action) => (
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
                </>
              )}
            </Stack>
          )}
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
        </Box>
      </QuerySection>
      {jobs.data && (
        <PaginationFooter
          pagination={jobs.data.pagination}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      )}
      <JobDrawer
        job={rows.find((job) => job.id === openId) ?? null}
        onClose={() => setOpenId(null)}
      />
    </Stack>
  );
}
