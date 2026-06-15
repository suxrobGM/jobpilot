import type {
  LinkedinTier,
  OutreachAutonomy,
  OutreachChannel,
  OutreachMessageStatus,
} from "@jobpilot/contracts/outreach";

export interface OutreachConfigDto {
  channels: OutreachChannel[];
  linkedinTier?: LinkedinTier;
  autonomy: OutreachAutonomy;
  dailyCap?: number;
  resumeUrl?: string;
}

export interface ContactDto {
  id: number;
  name: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  email: string | null;
  emailSource: string | null;
  emailConfidence: number | null;
  linkedinConnection: "none" | "pending" | "connected";
  discoverySource: string | null;
  matchConfidence: number | null;
  relatedAppId: number | null;
  relatedJobUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OutreachMessageDto {
  id: number;
  profileId: number;
  contactId: number;
  campaignId: string | null;
  channel: OutreachChannel;
  linkedinKind: "inmail" | "connect_note" | "dm" | null;
  subject: string | null;
  body: string;
  status: OutreachMessageStatus;
  failReason: string | null;
  providerId: string | null;
  threadId: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact: ContactDto;
}
