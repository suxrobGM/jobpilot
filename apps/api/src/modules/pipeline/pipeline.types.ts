import type { PipelineStage } from "./pipeline.constants";

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
