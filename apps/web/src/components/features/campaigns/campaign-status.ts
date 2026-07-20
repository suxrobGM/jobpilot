import { CAMPAIGN_STATUSES, type CampaignStatus } from "@jobpilot/contracts/campaign";

export const CAMPAIGN_STATUS_COLOR: Record<
  CampaignStatus,
  "default" | "info" | "success" | "error" | "warning"
> = {
  in_progress: "info",
  paused: "default",
  completed: "success",
  failed: "error",
};

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  in_progress: "in progress",
  paused: "paused",
  completed: "completed",
  failed: "failed",
};

export const CAMPAIGN_STATUS_OPTIONS = CAMPAIGN_STATUSES.map((value) => ({
  value,
  label: CAMPAIGN_STATUS_LABEL[value],
}));
