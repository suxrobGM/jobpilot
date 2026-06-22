import type { Data } from "@jobpilot/api-client";
import type { api } from "@/api/client";

// Runtime constants for the Kanban UI — values, so they stay here (not inferable).
export const PIPELINE_STAGES = ["queued", "applying", "submitted", "interviewing"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  queued: "Queued",
  applying: "Applying",
  submitted: "Submitted",
  interviewing: "Interviewing",
};

/** One paginated pipeline column, inferred from `GET /api/pipeline`. */
export type PipelineColumnPage = Data<typeof api.pipeline.get>;
export type PipelineJobDto = PipelineColumnPage["items"][number];
