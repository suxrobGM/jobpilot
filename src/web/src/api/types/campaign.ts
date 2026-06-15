import type {
  CampaignEventType,
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
} from "@jobpilot/contracts/campaign";
import type { OutreachConfigDto } from "./outreach";

export interface CampaignDto {
  campaignId: string;
  query: string;
  source: CampaignSource;
  status: CampaignStatus;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  config: CampaignConfigDto;
  summary: CampaignSummaryDto;
}

export interface CampaignConfigDto {
  board?: string;
  minScore?: number;
  maxApplications?: number;
  maxJobs?: number;
  outreach?: OutreachConfigDto;
}

export interface CampaignSummaryDto {
  totalFound: number;
  qualified: number;
  applied: number;
  failed: number;
  skipped: number;
  remaining: number;
  // Outreach campaigns fold their own counts here.
  discovered: number;
  drafted: number;
  sent: number;
  replied: number;
  bounced: number;
}

export interface CampaignJobDto {
  id: number;
  campaignId: string;
  key: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  type: string | null;
  url: string;
  board: string | null;
  matchScore: number | null;
  matchReason: string | null;
  status: CampaignJobStatus;
  appliedAt: string | null;
  failReason: string | null;
  retryNotes: string | null;
  skipReason: string | null;
  description: string | null;
}

export interface CampaignEventDto {
  id: number;
  campaignId: string;
  type: CampaignEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CampaignDetailDto extends CampaignDto {
  jobs: CampaignJobDto[];
}

export interface CreateCampaignRequest {
  campaignId: string;
  query: string;
  source: CampaignSource;
  config: CampaignConfigDto;
}
