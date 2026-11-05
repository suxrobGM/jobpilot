import type { CampaignMode } from "./form-config";

export const UPWORK_MODE_DESCRIPTION =
  "JobPilot searches Upwork, filters out low-quality and unresponsive clients, and ranks the rest by fit. Review the recommendations, then draft a proposal per job - you submit on Upwork yourself.";

export const SUBMIT_LABELS: Record<CampaignMode, string> = {
  search: "Start search",
  auto_apply: "Start auto-apply",
  networking: "Start networking",
  apply: "Apply to links",
};

export const MODE_DESCRIPTIONS: Record<CampaignMode, string> = {
  search: "Find jobs and score each match - nothing is sent. Review the ranked list yourself.",
  auto_apply:
    "Find jobs, score each match, then auto-submit applications to those above your score threshold.",
  networking: "Find hiring managers or recruiters and message them directly.",
  apply:
    "Already found the jobs yourself? Paste the links and the agent reviews fit, tailors your resume, and applies to each.",
};
