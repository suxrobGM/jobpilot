export const PIPELINE_STAGES = ["queued", "applying", "submitted", "interviewing"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_LABEL: Record<PipelineStage, string> = {
  queued: "Queued",
  applying: "Applying",
  submitted: "Submitted",
  interviewing: "Interviewing",
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
  stageSummary: string | null;
  url: string;
  campaignId: string | null;
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
  dateFrom?: string;
  dateTo?: string;
}
