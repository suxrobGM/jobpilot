import type { ApplicationSource, Stage } from "@/lib/schemas/application";

export interface ApplicationDto {
  id: number;
  url: string;
  title: string;
  company: string;
  location: string | null;
  board: string | null;
  source: ApplicationSource;
  appliedAt: string;
  stage: Stage;
  outcome: string | null;
  rejectedAt: string | null;
  matchScore: number | null;
  matchReason: string | null;
  failReason: string | null;
  runId: string | null;
}

export interface StageEventDto {
  id: number;
  applicationId: number;
  fromStage: Stage | null;
  toStage: Stage;
  note: string | null;
  occurredAt: string;
}

export interface ApplicationDetailDto extends ApplicationDto {
  stageEvents: StageEventDto[];
}

export type DuplicateMatchKind = "url" | "fuzzy";

export interface DuplicateMatch {
  kind: DuplicateMatchKind;
  application: {
    id: number;
    url: string;
    title: string;
    company: string;
    appliedAt: string;
    stage: Stage;
  };
  score?: number;
}

export interface DuplicateCheckResult {
  applied: boolean;
  match: DuplicateMatch | null;
}

export interface DashboardStats {
  total: number;
  last7Days: number;
  last30Days: number;
  positiveResponseRate: number;
  byStage: Record<Stage, number>;
  byBoard: { board: string; count: number }[];
  bySource: { source: ApplicationSource; count: number }[];
}

export interface ApplicationListFilters {
  stage?: Stage;
  board?: string;
  source?: ApplicationSource;
  search?: string;
}
