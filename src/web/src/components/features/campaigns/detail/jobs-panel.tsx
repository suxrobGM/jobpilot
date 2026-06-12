"use client";

import { useState, type ReactElement } from "react";
import { Autorenew, Clear, Replay } from "@mui/icons-material";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import type { GridRowSelectionModel } from "@mui/x-data-grid";
import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { CAMPAIGN_JOB_STATUSES, type CampaignJobStatus } from "@/api/contracts/campaign";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDetailDto, CampaignJobDto } from "@/api/types";
import { SelectField, type SelectFieldOption } from "@/components/ui/form";
import { SectionCard } from "@/components/ui/layout";
import { useAgent } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";
import { EMPTY_SELECTION, resolveSelectedRows } from "@/utils/grid-selection";
import { CampaignJobsTable, isReapplicable } from "./jobs-table";

const STATUS_OPTIONS: ReadonlyArray<SelectFieldOption<CampaignJobStatus>> =
  CAMPAIGN_JOB_STATUSES.map((s) => ({
    value: s,
    label: s,
  }));

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

interface CampaignJobsPanelProps {
  campaign: CampaignDetailDto;
  /** Per-job single Apply action (auto-apply campaigns). */
  onApplyJob?: (job: CampaignJobDto) => void;
  /** Per-job Draft proposal action (Upwork recommendation campaigns). */
  onDraftProposal?: (job: CampaignJobDto) => void;
  /** Show the recommendation-reason column. */
  showReason?: boolean;
}

/** Jobs table with status/search filtering and bulk re-apply / rescan of selected jobs. */
export function CampaignJobsPanel(props: CampaignJobsPanelProps): ReactElement {
  const { campaign, onApplyJob, onDraftProposal, showReason } = props;
  const agent = useAgent();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<CampaignJobStatus | null>(null);
  const [search, setSearch] = useState("");
  const [selection, setSelection] = useState<GridRowSelectionModel>(EMPTY_SELECTION);

  const term = search.trim().toLowerCase();
  const visible = campaign.jobs.filter(
    (j) =>
      (!statusFilter || j.status === statusFilter) &&
      (!term || `${j.title} ${j.company}`.toLowerCase().includes(term)),
  );

  const canReapply = campaign.status !== "in_progress";
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
          apiClient.patch<CampaignJobDto>(
            `/api/campaigns/${encodeURIComponent(campaign.campaignId)}/jobs/${encodeURIComponent(job.key)}`,
            { status: "approved" },
          ),
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
        onApplyJob={onApplyJob}
        onDraftProposal={onDraftProposal}
        showReason={showReason}
        checkboxSelection={canReapply}
        rowSelectionModel={selection}
        onRowSelectionModelChange={setSelection}
      />
    </SectionCard>
  );
}
