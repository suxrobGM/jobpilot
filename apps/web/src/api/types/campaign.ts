import type { Body, Data } from "@jobpilot/api-client";
import type { api } from "@/api/eden";

/** A campaign list row, inferred from `GET /api/campaigns`. */
export type CampaignDto = Data<typeof api.campaigns.get>[number];

/** A campaign with its jobs, from `GET /api/campaigns/:id`. */
export type CampaignDetailDto = Data<ReturnType<typeof api.campaigns>["get"]>;

export type CampaignConfigDto = CampaignDto["config"];
export type CampaignSummaryDto = CampaignDto["summary"];
export type CampaignJobDto = CampaignDetailDto["jobs"][number];

/** Create-campaign request body, from `POST /api/campaigns`. */
export type CreateCampaignRequest = Body<typeof api.campaigns.post>;
