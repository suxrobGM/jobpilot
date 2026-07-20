import type { Body, Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

/** A campaign list row, inferred from `GET /api/campaigns`. */
export type CampaignDto = Data<typeof api.campaigns.get>["items"][number];

/** A campaign with its jobs, from `GET /api/campaigns/:id`. */
export type CampaignDetailDto = Data<ReturnType<typeof api.campaigns>["get"]> & {
  jobs: Data<ReturnType<typeof api.campaigns>["jobs"]["get"]>["items"];
};

export type CampaignConfigDto = CampaignDto["config"];
export type CampaignSummaryDto = CampaignDto["summary"];
export type CampaignJobDto = CampaignDetailDto["jobs"][number];

export type CampaignJobSummaryDto = Extract<CampaignSummaryDto, { kind: "jobs" }>;
export type CampaignNetworkingSummaryDto = Extract<CampaignSummaryDto, { kind: "networking" }>;

/** Narrows a campaign's summary to the job shape, or null for a networking campaign. */
export function jobSummary(campaign: {
  summary: CampaignSummaryDto;
}): CampaignJobSummaryDto | null {
  return campaign.summary.kind === "jobs" ? campaign.summary : null;
}

/** Narrows a campaign's summary to the networking shape, or null for a job campaign. */
export function networkingSummary(campaign: {
  summary: CampaignSummaryDto;
}): CampaignNetworkingSummaryDto | null {
  return campaign.summary.kind === "networking" ? campaign.summary : null;
}

/** Create-campaign request body, from `POST /api/campaigns`. */
export type CreateCampaignRequest = Body<typeof api.campaigns.post>;
