import type { Application, Job, QueueEntry } from "@/generated/prisma/client";
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
  updatedAt: Date;
  liveStep: string | null;
  liveMessage: string | null;
  stageSummary: string | null;
  url: string;
  campaignId: string | null;
  applicationId: string | null;
}

export interface PipelineColumnPage {
  stage: PipelineStage;
  items: PipelineJobDto[];
  nextCursor: string | null;
  total: number;
  todayCount: number;
}

const APPLICATION_STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  recruiter_screen: "Recruiter screen",
  assessment: "Assessment",
  hiring_manager_screen: "Hiring manager screen",
  technical_interview: "Technical interview",
  onsite: "Onsite",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function formatApplicationStage(stage: string): string {
  return APPLICATION_STAGE_LABEL[stage] ?? stage;
}

function splitUrl(raw: string): { hostname: string; path: string } {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "");
    const path = `${u.pathname}${u.search}`.replace(/\/$/, "") || "/";
    return { hostname: host, path };
  } catch {
    return { hostname: raw, path: "" };
  }
}

export function toQueueEntry(entry: QueueEntry): PipelineJobDto {
  const { hostname, path } = splitUrl(entry.url);
  return {
    id: `queue:${entry.id}`,
    stage: "queued",
    role: hostname,
    company: path,
    location: null,
    board: null,
    matchScore: null,
    resumeVariant: null,
    updatedAt: entry.createdAt,
    liveStep: null,
    liveMessage: null,
    stageSummary: entry.note,
    url: entry.url,
    campaignId: null,
    applicationId: null,
  };
}

export function toCampaignJob(job: Job): PipelineJobDto {
  return {
    id: `campaign:${job.campaignId}:${job.key}`,
    stage: "applying",
    role: job.title,
    company: job.company,
    location: job.location,
    board: job.board,
    matchScore: job.matchScore,
    resumeVariant: null,
    updatedAt: job.appliedAt ?? new Date(),
    liveStep: job.status,
    liveMessage: job.retryNotes,
    stageSummary: null,
    url: job.url,
    campaignId: job.campaignId,
    applicationId: null,
  };
}

export function toApplication(app: Application, stage: PipelineStage): PipelineJobDto {
  return {
    id: `app:${app.id}`,
    stage,
    role: app.title,
    company: app.company,
    location: app.location,
    board: app.board,
    matchScore: app.matchScore,
    resumeVariant: null,
    updatedAt: app.appliedAt,
    liveStep: null,
    liveMessage: null,
    stageSummary: stage === "interviewing" ? formatApplicationStage(app.stage) : null,
    url: app.url,
    campaignId: app.campaignId,
    applicationId: app.id,
  };
}
