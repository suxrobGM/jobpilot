"use client";

import type { ReactElement } from "react";
import {
  ContentCopy,
  Delete,
  Description,
  Edit,
  MoreVert,
  OpenInNew,
  PlayArrow,
} from "@mui/icons-material";
import { IconButton } from "@mui/material";
import type { Route } from "next";
import { apiClient } from "@/api/client";
import { useApiMutation } from "@/api/hooks";
import { queryKeys } from "@/api/query-keys";
import type { PipelineJobDto } from "@/api/types";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/feedback";
import { useAgent } from "@/providers/agent-provider";
import { useToast } from "@/providers/notification-provider";

interface PipelineCardMenuProps {
  job: PipelineJobDto;
}

export function PipelineCardMenu(props: PipelineCardMenuProps): ReactElement {
  const { job } = props;
  const agent = useAgent();
  const toast = useToast();

  const queueId = job.stage === "queued" ? job.id.replace(/^queue:/, "") : null;
  const isQueued = job.stage === "queued";

  const remove = useApiMutation<{ deleted: string }, void>(
    () => apiClient.del<{ deleted: string }>(`/api/queue/${queueId}`),
    {
      successMessage: "Removed from queue",
      invalidate: [queryKeys.queue.all, queryKeys.pipeline.all],
    },
  );

  const copyUrl = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(job.url);
      toast.success("URL copied");
    } catch {
      toast.error("Couldn't access the clipboard");
    }
  };

  const items: DropdownMenuItem[] = [
    {
      kind: "item",
      key: "apply",
      label: "Apply",
      icon: <PlayArrow fontSize="sm" />,
      show: isQueued,
      onClick: () => void agent.injectSkill("apply", job.url),
    },
    {
      kind: "item",
      key: "tailor",
      label: "Tailor resume for this",
      icon: <Edit fontSize="sm" />,
      show: isQueued,
      onClick: () => void agent.injectSkill("tailor-resume", JSON.stringify(job.url)),
    },
    {
      kind: "item",
      key: "cover",
      label: "Cover letter",
      icon: <Description fontSize="sm" />,
      show: isQueued,
      onClick: () => void agent.injectSkill("cover-letter", job.url),
    },
    { kind: "divider", key: "after-queued", show: isQueued },
    {
      kind: "item",
      key: "open-campaign",
      label: "Open campaign",
      icon: <OpenInNew fontSize="sm" />,
      show: job.stage === "applying" && job.campaignId !== null,
      href: job.campaignId !== null ? (`/campaigns/${job.campaignId}` as Route) : undefined,
    },
    {
      kind: "item",
      key: "open-app",
      label: "Open application",
      icon: <OpenInNew fontSize="sm" />,
      show:
        (job.stage === "submitted" || job.stage === "interviewing") && job.applicationId !== null,
      href:
        job.applicationId !== null ? (`/applications/${job.applicationId}` as Route) : undefined,
    },
    {
      kind: "item",
      key: "copy",
      label: "Copy URL",
      icon: <ContentCopy fontSize="sm" />,
      onClick: () => void copyUrl(),
    },
    {
      kind: "item",
      key: "open-url",
      label: "Open URL in new tab",
      icon: <OpenInNew fontSize="sm" />,
      onClick: () => window.open(job.url, "_blank", "noopener,noreferrer"),
    },
    { kind: "divider", key: "before-remove", show: queueId !== null },
    {
      kind: "item",
      key: "remove",
      label: "Remove from queue",
      icon: <Delete fontSize="sm" color="error" />,
      show: queueId !== null,
      danger: true,
      disabled: remove.isPending,
      onClick: () => remove.mutate(),
    },
  ];

  return (
    <DropdownMenu
      stopPropagation
      items={items}
      trigger={({ onOpen }) => (
        <IconButton size="small" onClick={onOpen} aria-label="Card actions" sx={{ padding: 0.25 }}>
          <MoreVert fontSize="sm" />
        </IconButton>
      )}
    />
  );
}
