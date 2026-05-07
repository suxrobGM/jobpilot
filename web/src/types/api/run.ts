import type { RunEventType, RunJobStatus, RunSource, RunStatus } from "@/lib/schemas/run";

export interface RunDto {
  runId: string;
  query: string;
  source: RunSource;
  status: RunStatus;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  config: RunConfigDto;
  summary: RunSummaryDto;
}

export interface RunConfigDto {
  minMatchScore?: number;
  maxApplications?: number;
  boards?: string[];
}

export interface RunSummaryDto {
  totalFound: number;
  qualified: number;
  applied: number;
  failed: number;
  skipped: number;
  remaining: number;
}

export interface RunJobDto {
  id: number;
  runId: string;
  jobKey: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  type: string | null;
  url: string;
  board: string | null;
  matchScore: number | null;
  matchReason: string | null;
  status: RunJobStatus;
  appliedAt: string | null;
  failReason: string | null;
  retryNotes: string | null;
  skipReason: string | null;
  description: string | null;
}

export interface RunEventDto {
  id: number;
  runId: string;
  type: RunEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RunDetailDto extends RunDto {
  jobs: RunJobDto[];
}

export interface RunStatsDto {
  totalRuns: number;
  totalApplied: number;
  totalFailed: number;
  totalSkipped: number;
  successRate: number;
  byBoard: { board: string; count: number }[];
  failReasons: { reason: string; count: number }[];
  recentRuns: RunDto[];
}
