"use client";

import type { ReactElement } from "react";
import type { CampaignJobStatus, CampaignStatus } from "@jobpilot/contracts/campaign";
import type { ChipProps } from "@mui/material";
import { ColorChip } from "@/components/ui/display";

const CAMPAIGN_STATUS_COLOR: Record<CampaignStatus, ChipProps["color"]> = {
  in_progress: "info",
  paused: "default",
  completed: "success",
  failed: "error",
};

const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  in_progress: "in progress",
  paused: "paused",
  completed: "completed",
  failed: "failed",
};

interface CampaignStatusChipProps {
  status: CampaignStatus;
}

export function CampaignStatusChip(props: CampaignStatusChipProps): ReactElement {
  const { status } = props;
  return (
    <ColorChip
      value={status}
      colors={CAMPAIGN_STATUS_COLOR}
      label={CAMPAIGN_STATUS_LABEL[status]}
    />
  );
}

const CAMPAIGN_JOB_STATUS_COLOR: Record<CampaignJobStatus, ChipProps["color"]> = {
  pending: "default",
  approved: "info",
  applying: "primary",
  needs_user: "warning",
  applied: "success",
  failed: "error",
  skipped: "warning",
};

interface CampaignJobStatusChipProps {
  status: CampaignJobStatus;
}

export function CampaignJobStatusChip(props: CampaignJobStatusChipProps): ReactElement {
  const { status } = props;
  return <ColorChip value={status} colors={CAMPAIGN_JOB_STATUS_COLOR} />;
}
