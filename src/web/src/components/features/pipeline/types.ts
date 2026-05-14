export const PIPELINE_STAGES = [
  "discovered",
  "queued",
  "applying",
  "submitted",
  "replied",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export interface PipelineJob {
  id: string;
  stage: PipelineStage;
  role: string;
  company: string;
  location?: string;
  board: string;
  matchScore?: number;
  resumeVariant?: string;
  updatedAt: string;
  liveStep?: string;
  liveMessage?: string;
  replySummary?: string;
}

export interface PipelineColumnData {
  stage: PipelineStage;
  label: string;
  total: number;
  todayCount?: number;
  items: PipelineJob[];
  hasMore: boolean;
}

export const STAGE_LABEL: Record<PipelineStage, string> = {
  discovered: "Discovered",
  queued: "Queued",
  applying: "Applying",
  submitted: "Submitted",
  replied: "Replied",
};
