import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

export type JobReasonDto = Data<ReturnType<typeof api.feeds>["job-reasons"]["get"]>[number];

export type FeedDto = Data<typeof api.feeds.get>[number];

export type PipelineJobDto = Data<typeof api.pipeline.jobs.get>["items"][number];
