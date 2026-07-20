"use client";

import { type ReactElement, useState } from "react";
import { CAMPAIGN_JOB_STATUSES, type CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { Autorenew, Clear, Replay } from "@mui/icons-material";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import type { GridPaginationModel, GridRowSelectionModel } from "@mui/x-data-grid";
import { useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { apiErrorMessage } from "@/api/error";
import { useApiMutation, useApiQuery } from "@/api/hooks";
import { campaignQueries } from "@/api/queries";
import { invalidations } from "@/api/query-keys";
import type { CampaignDetailDto, CampaignJobDto } from "@/api/types";
import { SelectField, type SelectFieldOption } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";
import { EMPTY_SELECTION, resolveSelectedRows } from "@/utils/grid-selection";
import { UPWORK_DOMAIN } from "../composer/form-config";
import { CampaignJobsTable, isReapplicable } from "./jobs-table";

const STATUS_OPTIONS: ReadonlyArray<SelectFieldOption<CampaignJobStatus>> =
  CAMPAIGN_JOB_STATUSES.map((s) => ({
    value: s,
    label: s,
  }));

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

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

  const [statusFilter, setStatusFilter] = useState<CampaignJobStatus | null>(null);
  const [search, setSearch] = useState("");
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const isUpwork = campaign.config.board === UPWORK_DOMAIN;

  // Filters run server-side, so they cover the whole campaign rather than the loaded page.
  const term = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const jobs = useApiQuery(
    campaignQueries.jobs(campaign.campaignId, {
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      status: statusFilter ?? undefined,
      search: term || undefined,
    }),
  );
  const visible = jobs.data?.items ?? [];
  const total = jobs.data?.pagination.total ?? 0;

  // Re-apply / rescan drive the agent, so they're desktop-only.
  const canReapply = campaign.status !== "in_progress" && agentAvailable;
  const selected = canReapply
    ? resolveSelectedRows(selection, visible).filter((j) => isReapplicable(j.status))
    : [];
  const selectedSkipped = selected.filter((j) => j.status === "skipped");
  const selectedForReapply = selected.filter((job) => job.status !== "skipped");
  const hasFilters = statusFilter !== null || term !== "";

  // Keeps the model's identity stable while typing, so the grid doesn't re-render per keystroke.
  const resetPage = (): void => setPaginationModel((m) => (m.page === 0 ? m : { ...m, page: 0 }));

  const resetSelection = (): void => {
    setSelection(EMPTY_SELECTION);
    for (const key of invalidations.campaign) queryClient.invalidateQueries({ queryKey: key });
  };

  const reapply = useApiMutation<number, void>(
    async () => {
      const results = await Promise.all(
        selectedForReapply.map((job) => {
          const endpoint = api.campaigns({ id: campaign.campaignId }).jobs({ key: job.key });
          if (job.status === "failed") return endpoint.retry.post({});
          if (job.status === "approved") return Promise.resolve({ data: job, error: null });
          return endpoint.patch({ status: "approved" });
        }),
      );
      const failure = results.find((r) => r.error);
      return failure?.error
        ? { data: null, error: failure.error }
        : { data: selectedForReapply.length, error: null };
    },
    {
      invalidate: invalidations.campaign,
      successMessage: (n) => `Re-applying ${plural(n, "job")}`,
      onSuccess: () => {
        void agent.injectSkill("apply", `campaign ${campaign.campaignId}`);
        setSelection(EMPTY_SELECTION);
      },
    },
  );

  const rescanSelected = (): void => {
    const keys = selectedSkipped.map((j) => j.key).join(",");
    void agent.injectSkill("rescan-skipped", `${campaign.campaignId} --jobs ${keys}`);
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
  const draftProposal = async (job: CampaignJobDto): Promise<void> => {
    const res = await api.upwork.proposals.post({
      jobTitle: job.title,
      clientName: job.company || null,
      jobUrl: job.url,
      jobDescription: job.description ?? "",
      source: "search",
      campaignId: job.campaignId,
      jobKey: job.key,
    });
    if (res.error || !res.data) {
      toast.error(apiErrorMessage(res.error, "Could not create the proposal draft"));
      return;
    }
    void agent.injectSkill("upwork-proposal", String(res.data.id));
    router.push(`/upwork/${res.data.id}` as Route);
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
          onChange={(next) => {
            setStatusFilter(next);
            resetPage();
          }}
        />
        <TextField
          size="small"
          label="Search title / company"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            resetPage();
          }}
          sx={{ minWidth: 220 }}
        />
        {hasFilters && (
          <Button
            size="small"
            variant="text"
            startIcon={<Clear fontSize="sm" />}
            onClick={() => {
              setStatusFilter(null);
              setSearch("");
              resetPage();
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
        rowCount={total}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
      />
    </SectionCard>
  );
}
