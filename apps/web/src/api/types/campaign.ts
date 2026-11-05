import type { Body, Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type CampaignDto = Data<typeof api.campaigns.get>["items"][number];

/** No jobs: a campaign can hold far more than a page, so they're fetched separately. */
export type CampaignDetailDto = Data<ReturnType<typeof api.campaigns>["get"]>;

export type CampaignConfigDto = CampaignDto["config"];
export type CampaignSummaryDto = CampaignDto["summary"];
export type CampaignJobDto = Data<ReturnType<typeof api.campaigns>["jobs"]["get"]>["items"][number];
export type CampaignJobReasonDto = Data<
  ReturnType<typeof api.campaigns>["job-reasons"]["get"]
>[number];

export type CampaignJobSummaryDto = Extract<CampaignSummaryDto, { kind: "jobs" }>;

/** Narrows a campaign's summary to the job shape, or null for a networking campaign. */
export function jobSummary(campaign: {
  summary: CampaignSummaryDto;
}): CampaignJobSummaryDto | null {
  return campaign.summary.kind === "jobs" ? campaign.summary : null;
}

export type CreateCampaignRequest = Body<typeof api.campaigns.post>;
