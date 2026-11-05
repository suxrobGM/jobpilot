"use client";

import { type ReactElement, useRef, useState } from "react";
import { CAMPAIGN_JOB_STATUSES } from "@jobpilot/contracts/campaign";
import { Autorenew, Clear, Replay } from "@mui/icons-material";
import { Box, Button, Stack, Typography } from "@mui/material";
import type { GridRowSelectionModel } from "@mui/x-data-grid";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { campaignQueries, invalidations } from "@/api/queries";
import type { CampaignDetailDto, CampaignJobDto } from "@/api/types";
import { statusOptions } from "@/components/ui/display";
import { SearchField, SelectField } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { gridPagination, usePaginationParams } from "@/hooks/use-pagination";
import { useUrlSearch } from "@/hooks/use-url-search";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useToast } from "@/providers/toast-provider";
import { plural } from "@/utils/format";
import { EMPTY_SELECTION, resolveSelectedRows } from "@/utils/grid-selection";
import { enumParam } from "@/utils/search-params";
import { UPWORK_DOMAIN } from "../constants";
import { CampaignJobsTable, isReapplicable } from "./jobs-table";

const STATUS_OPTIONS = statusOptions("campaignJob");

interface CampaignJobsPanelProps {
  campaign: CampaignDetailDto;
}

/** Jobs table with status/search filtering and bulk re-apply / rescan of selected jobs. */
export function CampaignJobsPanel(props: CampaignJobsPanelProps): ReactElement {
  const { campaign } = props;
  const agent = useAgent();
  const agentAvailable = useAgentAvailable();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();

  const pagination = usePaginationParams({ prefix: "jobs" });
  const statusFilter = enumParam(CAMPAIGN_JOB_STATUSES, useSearchParams().get("jobsStatus"));
  const search = useUrlSearch("jobsQ", pagination);
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const isUpwork = campaign.board?.domain === UPWORK_DOMAIN;

  // Filters run server-side, so they cover the whole campaign rather than the loaded page.
  const jobs = useQuery(
    campaignQueries.jobs(campaign.id, {
      ...pagination.query,
      status: statusFilter ?? undefined,
      search: search.applied || undefined,
    }),
  );
  const visible = jobs.data?.items ?? [];
  const total = jobs.data?.pagination.total ?? 0;

  // The grid keeps off-page ids selected (keepNonExistentRowsSelected), so resolving
  // against the current page alone would silently drop selections made on other pages.
  const seenJobs = useRef(new Map<string, CampaignJobDto>());
  for (const job of visible) {
    seenJobs.current.set(job.id, job);
  }

  // Re-apply / rescan drive the agent, so they're desktop-only.
  const canReapply = campaign.status !== "in_progress" && agentAvailable;
  const selected = canReapply
    ? resolveSelectedRows(selection, [...seenJobs.current.values()], visible).filter((j) =>
        isReapplicable(j.status),
      )
    : [];
  const selectedSkipped = selected.filter((j) => j.status === "skipped");
  const selectedForReapply = selected.filter((job) => job.status !== "skipped");
  const hasFilters = statusFilter !== null || search.applied !== "";

  const resetSelection = (): void => {
    setSelection(EMPTY_SELECTION);
    for (const key of invalidations.campaign) queryClient.invalidateQueries({ queryKey: key });
  };

  // Per-job requests commit independently, so a rejection can't invalidate the whole
  // batch - report the split instead of surfacing the first error as a total failure.
  const reapply = useApiMutation(
    async () => {
      const results = await Promise.allSettled(
        selectedForReapply.map((job) => {
          const endpoint = api.campaigns({ id: campaign.id }).jobs({ key: job.key });
          if (job.status === "failed") {
            return endpoint.retry.post({});
          }
          if (job.status === "approved") {
            return Promise.resolve({ data: job, error: null });
          }
          return endpoint.patch({ status: "approved" });
        }),
      );
      const ok = results.filter((r) => r.status === "fulfilled" && !r.value.error).length;
      return { data: { ok, failed: results.length - ok }, error: null };
    },
    {
      invalidate: invalidations.campaign,
      successMessage: ({ ok, failed }) =>
        failed === 0
          ? `Re-applying ${plural(ok, "job")}`
          : `Re-applying ${ok} of ${plural(ok + failed, "job")} - ${failed} failed`,
      onSuccess: ({ ok }) => {
        if (ok > 0) {
          void agent.injectSkill("apply", `campaign ${campaign.id}`);
        }
        setSelection(EMPTY_SELECTION);
      },
    },
  );

  const rescanSelected = (): void => {
    const keys = selectedSkipped.map((j) => j.key).join(",");
    void agent.injectSkill("rescan-skipped", `${campaign.id} --jobs ${keys}`);
    toast.success(`Rescanning ${plural(selectedSkipped.length, "skipped job")}`);
    resetSelection();
  };

  // Auto-apply campaigns apply on their own; on other campaigns (e.g. search results) the
  // user dispatches a job to the single-job apply flow by its URL.
  const applyJob = (job: CampaignJobDto): void => {
    void agent.injectSkill("apply", job.url);
  };

  // Upwork recommendations are recommend-only: seed a proposal draft from the
  // recommendation, then hand off to the upwork-proposal skill to write it.
  const createDraft = useApiMutation(
    (job: CampaignJobDto) =>
      api.upwork.proposals.post({
        jobTitle: job.title,
        clientName: job.company || null,
        jobUrl: job.url,
        jobDescription: job.description ?? "",
        source: "search",
        jobId: job.id,
      }),
    {
      onSuccess: ({ id }) => {
        void agent.injectSkill("upwork-proposal", id);
        router.push(`/upwork/${id}` as Route);
      },
    },
  );
  // A double click would otherwise create two drafts for one job.
  const draftProposal = (job: CampaignJobDto): void => {
    if (!createDraft.isPending) {
      createDraft.mutate(job);
    }
  };

  return (
    <SectionCard title="Jobs" description="Updated live as the campaign progresses.">
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", md: "center" }, mb: 2 }}
      >
        <SelectField
          label="Status"
          value={statusFilter}
          options={STATUS_OPTIONS}
          onChange={(next) => pagination.setFilters({ jobsStatus: next })}
        />
        <SearchField
          placeholder="Search title / company"
          value={search.draft}
          onChange={search.setDraft}
        />
        {hasFilters && (
          <Button
            size="small"
            variant="text"
            startIcon={<Clear fontSize="sm" />}
            onClick={() => {
              search.setDraft("");
              pagination.setFilters({ jobsStatus: null, jobsQ: null });
            }}
          >
            Clear
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        {canReapply && selectedSkipped.length > 0 && (
          <Button
            variant="outlined"
            startIcon={<Autorenew fontSize="sm" />}
            onClick={rescanSelected}
          >
            Rescan selected ({selectedSkipped.length})
          </Button>
        )}
        {canReapply && selectedForReapply.length > 0 && (
          <Button
            variant="contained"
            startIcon={<Replay fontSize="sm" />}
            disabled={reapply.isPending}
            onClick={() => reapply.mutate()}
          >
            Re-apply selected ({selectedForReapply.length})
          </Button>
        )}
        <Typography variant="captionMuted">{plural(total, "job")}</Typography>
      </Stack>
      <CampaignJobsTable
        rows={visible}
        loading={jobs.isLoading}
        onApplyJob={!isUpwork && agentAvailable ? applyJob : undefined}
        onDraftProposal={isUpwork && agentAvailable ? draftProposal : undefined}
        showReason={isUpwork}
        checkboxSelection={canReapply}
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
        {...gridPagination(pagination, jobs.data?.pagination)}
      />
    </SectionCard>
  );
}
