export const PIPELINE_STAGES = [
  "discovered",
  "queued",
  "applying",
  "submitted",
  "replied",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  discovered: "Discovered",
  queued: "Queued",
  applying: "Applying",
  submitted: "Submitted",
  replied: "Replied",
};

export interface PipelineJobDto {
  id: string;
  stage: PipelineStage;
  role: string;
  company: string;
  location: string | null;
  board: string | null;
  matchScore: number | null;
  resumeVariant: string | null;
  updatedAt: string;
  liveStep: string | null;
  liveMessage: string | null;
  replySummary: string | null;
  url: string;
  runId: string | null;
  applicationId: number | null;
}

export interface PipelineColumnPage {
  stage: PipelineStage;
  items: PipelineJobDto[];
  nextCursor: string | null;
  total: number;
  todayCount: number;
}

export interface PipelineFilters {
  stage: PipelineStage;
  cursor?: string;
  limit?: number;
  search?: string;
  board?: string;
  matchMin?: number;
  dateFrom?: string;
  dateTo?: string;
}
