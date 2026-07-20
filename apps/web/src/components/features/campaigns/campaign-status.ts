import type { CampaignJobStatus, CampaignStatus } from "@jobpilot/contracts/campaign";

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

export const CAMPAIGN_JOB_STATUS_COLOR: Record<
  CampaignJobStatus,
  "default" | "info" | "primary" | "success" | "error" | "warning"
> = {
  pending: "default",
  approved: "info",
  applying: "primary",
  needs_user: "warning",
  applied: "success",
  failed: "error",
  skipped: "warning",
};
