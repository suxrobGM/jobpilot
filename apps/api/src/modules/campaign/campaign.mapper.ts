import type {
  CampaignConfig,
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
  CampaignSummary,
} from "@jobpilot/contracts/campaign";
import type {
  contactLinkedinConnectionSchema,
  OutreachChannel,
  OutreachMessageStatus,
} from "@jobpilot/contracts/outreach";
import type { z } from "zod/v4";
import type { Prisma } from "@/generated/prisma/client";

/** Contact connection-state union — derived from the contract schema. */
type ContactLinkedinConnection = z.infer<typeof contactLinkedinConnectionSchema>;

/**
 * A Job row with `status` narrowed to the campaign job-status union and the
 * `appliedAt` Date serialized to its ISO `string` wire form.
 */
export type CampaignJobRow = Omit<Prisma.JobGetPayload<{}>, "appliedAt"> & {
  status: CampaignJobStatus;
  appliedAt: string | null;
};

/**
 * A Campaign row with `status`/`source` narrowed, `config`/`summary` typed, and
 * the `startedAt`/`updatedAt`/`completedAt` Dates serialized to ISO `string`s.
 */
export type CampaignRow = Omit<
  Prisma.CampaignGetPayload<{}>,
  "config" | "summary" | "startedAt" | "updatedAt" | "completedAt"
> & {
  status: CampaignStatus;
  source: CampaignSource;
  config: CampaignConfig;
  summary: CampaignSummary;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
};

/** The nested contact on an OutreachMessage row, with Dates serialized to ISO. */
type OutreachContactRow = Omit<
  Prisma.ContactGetPayload<{}>,
  "linkedinConnection" | "createdAt" | "updatedAt"
> & {
  linkedinConnection: ContactLinkedinConnection;
  createdAt: string;
  updatedAt: string;
};

/**
 * An OutreachMessage row (with its contact) with `status`/`channel` and the nested
 * contact's `linkedinConnection` narrowed to the contract unions, and all Dates
 * (`sentAt`/`repliedAt`/`createdAt`/`updatedAt` plus the contact's) serialized to ISO.
 */
type OutreachMessageRow = Omit<
  Prisma.OutreachMessageGetPayload<{ include: { contact: true } }>,
  "sentAt" | "repliedAt" | "createdAt" | "updatedAt" | "contact"
> & {
  status: OutreachMessageStatus;
  channel: OutreachChannel;
  sentAt: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contact: OutreachContactRow;
};

/** Serialize a Job row's `status`/Date fields to their wire shape. */
export function toCampaignJobRow(job: Prisma.JobGetPayload<{}>): CampaignJobRow {
  return {
    ...job,
    status: job.status as CampaignJobStatus,
    appliedAt: job.appliedAt?.toISOString() ?? null,
  };
}

/** Serialize an OutreachMessage row (with contact) to its wire shape. */
export function toOutreachMessageRow(
  message: Prisma.OutreachMessageGetPayload<{ include: { contact: true } }>,
): OutreachMessageRow {
  return {
    ...message,
    status: message.status as OutreachMessageStatus,
    channel: message.channel as OutreachChannel,
    sentAt: message.sentAt?.toISOString() ?? null,
    repliedAt: message.repliedAt?.toISOString() ?? null,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
    contact: {
      ...message.contact,
      linkedinConnection: message.contact.linkedinConnection as ContactLinkedinConnection,
      createdAt: message.contact.createdAt.toISOString(),
      updatedAt: message.contact.updatedAt.toISOString(),
    },
  };
}
