"use client";

import { type ReactElement, useState } from "react";
import type { CampaignStatus } from "@jobpilot/contracts/campaign";
import { Autorenew, Delete, DoneAll, MoreVert, PlayArrow, Replay } from "@mui/icons-material";
import { Button, IconButton, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import { api } from "@/api/client";
import { campaignQueries } from "@/api/queries";
import { type CampaignDetailDto, jobSummary } from "@/api/types";
import { useApiMutation } from "@/api/use-api-mutation";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/navigation";
import { useAgent, useAgentAvailable } from "@/providers/agent-provider";
import { useConfirm } from "@/providers/confirm-provider";
import { PauseCampaignButton } from "../pause-campaign-button";
import { RescanDialog } from "./rescan-dialog";

interface CampaignActionsBarProps {
  campaign: CampaignDetailDto;
}

function useStatusMutation(
  campaignId: string,
  status: CampaignStatus,
  successMessage: string,
): ReturnType<typeof useApiMutation<unknown, void>> {
  return useApiMutation(
    () => api.campaigns({ id: campaignId }).status.post({ status, actor: "user" }),
    { successMessage, invalidate: [campaignQueries.all] },
  );
}

export function CampaignActionsBar(props: CampaignActionsBarProps): ReactElement {
  const { campaign } = props;
  const agent = useAgent();
  const agentAvailable = useAgentAvailable();
  const confirm = useConfirm();
  const router = useRouter();

  const complete = useStatusMutation(campaign.id, "completed", "Campaign marked as done");

  const [rescanOpen, setRescanOpen] = useState(false);

  const remove = useApiMutation(() => api.campaigns({ id: campaign.id }).delete(), {
    successMessage: "Campaign deleted",
    invalidate: [campaignQueries.all],
    onSuccess: () => router.replace("/workspace"),
  });

  const summary = jobSummary(campaign);
  const failedCount = summary?.failed ?? 0;
  const skippedCount = summary?.skipped ?? 0;
  const isInProgress = campaign.status === "in_progress";
  const isAutoApply = campaign.source === "auto_apply";
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

  // Networking campaigns have no jobs to replay - re-run the networking skill instead of `resume-campaign`.
  const handleResume = (): void => {
    void (campaign.source === "networking"
      ? agent.injectSkill("networking", `--campaign ${campaign.id}`)
      : agent.injectSkill("resume-campaign", campaign.id));
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
      onClick: () => void agent.injectSkill("auto-apply", `retry-failed ${campaign.id}`),
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
      {isInProgress && <PauseCampaignButton campaignId={campaign.id} />}
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

      <RescanDialog campaign={campaign} open={rescanOpen} onClose={() => setRescanOpen(false)} />
    </Stack>
  );
}
