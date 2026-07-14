"use client";

import { type ReactElement, useState } from "react";
import { CAMPAIGN_JOB_STATUSES, type CampaignJobStatus } from "@jobpilot/contracts/campaign";
import { Autorenew, Clear, Replay } from "@mui/icons-material";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import type { GridRowSelectionModel } from "@mui/x-data-grid";
import { useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { apiErrorMessage } from "@/api/error";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDetailDto, CampaignJobDto } from "@/api/types";
import { SelectField, type SelectFieldOption } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
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
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const isUpwork = campaign.config.board === UPWORK_DOMAIN;

  const term = search.trim().toLowerCase();
  const visible = campaign.jobs.filter(
    (j) =>
      (!statusFilter || j.status === statusFilter) &&
      (!term || `${j.title} ${j.company}`.toLowerCase().includes(term)),
  );

  // Re-apply / rescan drive the agent, so they're desktop-only.
  const canReapply = campaign.status !== "in_progress" && agentAvailable;
  const selected = canReapply
    ? resolveSelectedRows(selection, campaign.jobs, visible).filter((j) => isReapplicable(j.status))
    : [];
  const selectedSkipped = selected.filter((j) => j.status === "skipped");
  const hasFilters = statusFilter !== null || term !== "";

  const resetSelection = (): void => {
    setSelection(EMPTY_SELECTION);
    queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.detail(campaign.campaignId) });
  };

  const reapply = useApiMutation<number, void>(
    async () => {
      const results = await Promise.all(
        selected.map((job) =>
          api.campaigns({ id: campaign.campaignId }).jobs({ key: job.key }).patch({
            status: "approved",
          }),
        ),
      );
      const failure = results.find((r) => r.error);
      return failure?.error
        ? { data: null, error: failure.error }
        : { data: selected.length, error: null };
    },
    {
      invalidate: [queryKeys.campaigns.detail(campaign.campaignId)],
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
          onChange={setStatusFilter}
        />
        <TextField
          size="small"
          label="Search title / company"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
        {canReapply && selected.length > 0 && (
          <Button
            variant="contained"
            startIcon={<Replay fontSize="sm" />}
            disabled={reapply.isPending}
            onClick={() => reapply.mutate()}
          >
            Re-apply selected ({selected.length})
          </Button>
        )}
        <Typography variant="captionMuted">{plural(visible.length, "job")}</Typography>
      </Stack>
      <CampaignJobsTable
        rows={visible}
        onApplyJob={!isUpwork && agentAvailable ? applyJob : undefined}
        onDraftProposal={isUpwork && agentAvailable ? draftProposal : undefined}
        showReason={isUpwork}
        checkboxSelection={canReapply}
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
      />
    </SectionCard>
  );
}
