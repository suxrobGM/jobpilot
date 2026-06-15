"use client";

import { useState, type ReactElement } from "react";
import {
  Autorenew,
  Delete,
  DoneAll,
  MoreVert,
  Pause,
  PlayArrow,
  Replay,
} from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Stack,
  Typography,
} from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { apiClient } from "@/api/client";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { CampaignDetailDto } from "@/api/types";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/feedback";
import { useAgent } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";

interface CampaignActionsBarProps {
  campaign: CampaignDetailDto;
}

export function CampaignActionsBar(props: CampaignActionsBarProps): ReactElement {
  const { campaign } = props;
  const agent = useAgent();
  const confirm = useConfirm();
  const router = useRouter();

  const campaignPath = `/api/campaigns/${encodeURIComponent(campaign.campaignId)}`;

  const stop = useApiMutation<CampaignDetailDto, void>(
    () =>
      apiClient.patch<CampaignDetailDto>(campaignPath, {
        status: "paused" satisfies CampaignStatus,
      }),
    {
      successMessage: "Campaign paused",
      invalidate: [queryKeys.campaigns.all, queryKeys.pipeline.all],
    },
  );

  const complete = useApiMutation<CampaignDetailDto, void>(
    () =>
      apiClient.patch<CampaignDetailDto>(campaignPath, {
        status: "completed" satisfies CampaignStatus,
        completedAt: new Date().toISOString(),
      }),
    {
      successMessage: "Campaign marked as done",
      invalidate: [queryKeys.campaigns.all, queryKeys.pipeline.all],
    },
  );

  const [rescanOpen, setRescanOpen] = useState(false);
  const [minScore, setMinScore] = useState(campaign.config.minScore ?? 70);

  const rescan = useApiMutation<CampaignDetailDto, void>(
    () => apiClient.patch<CampaignDetailDto>(campaignPath, { config: { minScore } }),
    { invalidate: [queryKeys.campaigns.detail(campaign.campaignId), queryKeys.campaigns.all] },
  );

  const remove = useApiMutation<{ deleted: true; campaignId: string }, void>(
    () => apiClient.del<{ deleted: true; campaignId: string }>(campaignPath),
    {
      successMessage: "Campaign deleted",
      invalidate: [queryKeys.campaigns.all, queryKeys.pipeline.all],
      onSuccess: () => router.replace("/" as Route),
    },
  );

  const failedCount = campaign.jobs.filter((j) => j.status === "failed").length;
  const skippedCount = campaign.summary.skipped;
  const isInProgress = campaign.status === "in_progress";
  const isAutoApply = campaign.source === "auto-apply";
  const isStopped = campaign.status === "paused" || campaign.status === "interrupted";
  const hasActionItems =
    isStopped || (isAutoApply && failedCount > 0) || (!isInProgress && skippedCount > 0);

  const handleMarkDone = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Mark campaign as done?",
      description:
        "It stops counting as interrupted and won't be resumable. Use this for campaigns you stopped on purpose.",
      confirmLabel: "Mark as done",
    });
    if (confirmed) {
      complete.mutate();
    }
  };

  const handleDelete = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Delete campaign?",
      description:
        "Permanently deletes this campaign and all of its data — jobs, history, applications it produced, and outreach. This cannot be undone.",
      confirmLabel: "Delete campaign",
      destructive: true,
      confirmationText: "delete",
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  const handleRescanConfirm = async (): Promise<void> => {
    await rescan.mutateAsync();
    void agent.injectSkill("rescan-skipped", campaign.campaignId);
    setRescanOpen(false);
  };

  // Outreach campaigns have no jobs to replay — re-run the outreach skill instead of `resume`.
  const handleResume = (): void => {
    void (campaign.source === "outreach"
      ? agent.injectSkill("outreach", `--campaign ${campaign.campaignId}`)
      : agent.injectSkill("resume", campaign.campaignId));
  };

  const menuItems: DropdownMenuItem[] = [
    {
      kind: "item",
      key: "done",
      label: "Mark as done",
      icon: <DoneAll fontSize="sm" />,
      show: isStopped,
      disabled: complete.isPending,
      onClick: () => void handleMarkDone(),
    },
    {
      kind: "item",
      key: "retry",
      label: `Retry failed (${failedCount})`,
      icon: <Replay fontSize="sm" />,
      show: isAutoApply && failedCount > 0,
      onClick: () => void agent.injectSkill("auto-apply", `retry-failed ${campaign.campaignId}`),
    },
    {
      kind: "item",
      key: "rescan",
      label: `Rescan skipped (${skippedCount})…`,
      icon: <Autorenew fontSize="sm" />,
      show: !isInProgress && skippedCount > 0,
      onClick: () => setRescanOpen(true),
    },
    { kind: "divider", key: "del-divider", show: hasActionItems },
    {
      kind: "item",
      key: "delete",
      label: "Delete campaign",
      icon: <Delete fontSize="sm" />,
      danger: true,
      show: true,
      disabled: remove.isPending,
      onClick: () => void handleDelete(),
    },
  ];

  const hasMenu = menuItems.some((item) => item.kind === "item" && item.show !== false);

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {isInProgress && (
        <Button
          variant="outlined"
          color="warning"
          startIcon={<Pause fontSize="sm" />}
          onClick={() => stop.mutate()}
          disabled={stop.isPending}
        >
          Stop
        </Button>
      )}
      {isStopped && (
        <Button variant="contained" startIcon={<PlayArrow fontSize="sm" />} onClick={handleResume}>
          Resume
        </Button>
      )}
      {hasMenu && (
        <DropdownMenu
          items={menuItems}
          trigger={({ onOpen }) => (
            <IconButton onClick={onOpen} aria-label="More campaign actions">
              <MoreVert fontSize="sm" />
            </IconButton>
          )}
        />
      )}

      <Dialog open={rescanOpen} onClose={() => setRescanOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Rescan skipped jobs</DialogTitle>
        <DialogContent>
          <Stack spacing={1} sx={{ pt: 1 }}>
            <Typography variant="body2Muted">
              Re-scores the {skippedCount} skipped {skippedCount === 1 ? "job" : "jobs"} against a
              new threshold and sets eligible ones to <strong>approved</strong> — apply them from
              the jobs list or with Re-apply selected. Lower the threshold to recover jobs dropped
              just below the cutoff.
            </Typography>
            <Typography variant="body2">Min match score: {minScore}</Typography>
            <Slider
              value={minScore}
              min={0}
              max={100}
              step={5}
              marks
              valueLabelDisplay="auto"
              onChange={(_, v) => setMinScore(v as number)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRescanOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={rescan.isPending}
            onClick={() => void handleRescanConfirm()}
          >
            Rescan
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
