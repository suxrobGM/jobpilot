"use client";

import { type ReactElement, useState } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import {
  Autorenew,
  Delete,
  DoneAll,
  MoreVert,
  Pause,
  PlayArrow,
  Replay,
} from "@mui/icons-material";
import { Button, IconButton, Stack } from "@mui/material";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { invalidations } from "@/api/query-keys";
import { type CampaignDetailDto, jobSummary } from "@/api/types";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/feedback";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { RescanDialog } from "./rescan-dialog";

/** Matches the composer's default so a campaign created without one rescans from the same floor. */
const DEFAULT_MIN_SCORE = 60;

interface CampaignActionsBarProps {
  campaign: CampaignDetailDto;
}

export function CampaignActionsBar(props: CampaignActionsBarProps): ReactElement {
  const { campaign } = props;
  const agent = useAgent();
  const agentAvailable = useAgentAvailable();
  const confirm = useConfirm();
  const router = useRouter();

  const campaignResource = api.campaigns({ id: campaign.campaignId });

  const stop = useApiMutation<unknown, void>(
    () =>
      campaignResource.status.post({
        status: "paused" satisfies CampaignStatus,
      }),
    {
      successMessage: "Campaign paused",
      invalidate: invalidations.campaign,
    },
  );

  const complete = useApiMutation<unknown, void>(
    () =>
      campaignResource.status.post({
        status: "completed" satisfies CampaignStatus,
      }),
    {
      successMessage: "Campaign marked as done",
      invalidate: invalidations.campaign,
    },
  );

  const [rescanOpen, setRescanOpen] = useState(false);

  const rescan = useApiMutation<unknown, number>(
    (minScore) => campaignResource.patch({ config: { ...campaign.config, minScore } }),
    { invalidate: invalidations.campaign },
  );

  const remove = useApiMutation<unknown, void>(() => campaignResource.delete(), {
    successMessage: "Campaign deleted",
    invalidate: invalidations.campaign,
    onSuccess: () => router.replace("/" as Route),
  });

  const summary = jobSummary(campaign);
  const failedCount = summary?.failed ?? 0;
  const skippedCount = summary?.skipped ?? 0;
  const isInProgress = campaign.status === "in_progress";
  const isAutoApply = campaign.source === "auto-apply";
  const isStopped = campaign.status === "paused";
  const hasActionItems =
    isStopped ||
    (agentAvailable && ((isAutoApply && failedCount > 0) || (!isInProgress && skippedCount > 0)));

  const handleMarkDone = async (): Promise<void> => {
    const confirmed = await confirm({
      title: "Mark campaign as done?",
      description:
        "This closes the campaign permanently. Use it for campaigns you stopped on purpose.",
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
        "Permanently deletes this campaign and all of its data - jobs, history, applications it produced, and networking activity. This cannot be undone.",
      confirmLabel: "Delete campaign",
      destructive: true,
      confirmationText: "delete",
    });
    if (confirmed) {
      remove.mutate();
    }
  };

  const handleRescanConfirm = async (minScore: number): Promise<void> => {
    try {
      await rescan.mutateAsync(minScore);
    } catch {
      // onError already toasted; keep the dialog open so the threshold isn't lost.
      return;
    }
    void agent.injectSkill("rescan-skipped", campaign.campaignId);
    setRescanOpen(false);
  };

  // Networking campaigns have no jobs to replay - re-run the networking skill instead of `resume`.
  const handleResume = (): void => {
    void (campaign.source === "networking"
      ? agent.injectSkill("networking", `--campaign ${campaign.campaignId}`)
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
      show: isAutoApply && failedCount > 0 && agentAvailable,
      onClick: () => void agent.injectSkill("auto-apply", `retry-failed ${campaign.campaignId}`),
    },
    {
      kind: "item",
      key: "rescan",
      label: `Rescan skipped (${skippedCount})…`,
      icon: <Autorenew fontSize="sm" />,
      show: !isInProgress && skippedCount > 0 && agentAvailable,
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
      {isStopped && agentAvailable && (
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

      <RescanDialog
        open={rescanOpen}
        onClose={() => setRescanOpen(false)}
        skippedCount={skippedCount}
        defaultMinScore={campaign.config.minScore ?? DEFAULT_MIN_SCORE}
        pending={rescan.isPending}
        onConfirm={(minScore) => void handleRescanConfirm(minScore)}
      />
    </Stack>
  );
}
