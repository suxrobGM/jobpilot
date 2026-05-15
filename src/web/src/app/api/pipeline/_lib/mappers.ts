import type { Application, QueueEntry, RunJob } from "@/generated/prisma/client";
import type { PipelineJobDto, PipelineStage } from "@/types/api/pipeline";

export function mapQueueEntry(entry: QueueEntry): PipelineJobDto {
  return {
    id: `queue:${entry.id}`,
    stage: "queued",
    role: entry.note ?? "Pending application",
    company: "—",
    location: null,
    board: null,
    matchScore: null,
    resumeVariant: null,
    updatedAt: entry.createdAt.toISOString(),
    liveStep: null,
    liveMessage: null,
    replySummary: null,
    url: entry.url,
    runId: null,
    applicationId: null,
  };
}

export function mapRunJob(job: RunJob): PipelineJobDto {
  return {
    id: `run:${job.runId}:${job.jobKey}`,
    stage: "applying",
    role: job.title,
    company: job.company,
    location: job.location,
    board: job.board,
    matchScore: job.matchScore,
    resumeVariant: null,
    updatedAt: (job.appliedAt ?? new Date()).toISOString(),
    liveStep: job.status,
    liveMessage: job.retryNotes,
    replySummary: null,
    url: job.url,
    runId: job.runId,
    applicationId: null,
  };
}

export function mapApplication(app: Application, stage: PipelineStage): PipelineJobDto {
  return {
    id: `app:${app.id}`,
    stage,
    role: app.title,
    company: app.company,
    location: app.location,
    board: app.board,
    matchScore: app.matchScore,
    resumeVariant: null,
    updatedAt: app.appliedAt.toISOString(),
    liveStep: null,
    liveMessage: null,
    replySummary: stage === "replied" ? app.outcome ?? `Stage: ${app.stage}` : null,
    url: app.url,
    runId: app.runId,
    applicationId: app.id,
  };
}
