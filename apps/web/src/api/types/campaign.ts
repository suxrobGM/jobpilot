import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type CampaignJobReasonDto = Data<
  ReturnType<typeof api.campaigns>["job-reasons"]["get"]
>[number];

export type PipelineJobDto = Data<typeof api.pipeline.jobs.get>["items"][number];
