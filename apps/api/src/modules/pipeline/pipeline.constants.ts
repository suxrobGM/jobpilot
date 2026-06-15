export const PIPELINE_STAGES = ["queued", "applying", "submitted", "interviewing"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  queued: "Queued",
  applying: "Applying",
  submitted: "Submitted",
  interviewing: "Interviewing",
};
