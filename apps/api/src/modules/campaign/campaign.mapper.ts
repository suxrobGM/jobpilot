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
 * `appliedAt` Date carried through as a raw `Date` (Elysia serializes it on the wire).
 */
export type CampaignJobRow = Omit<Prisma.JobGetPayload<{}>, "appliedAt"> & {
  status: CampaignJobStatus;
  appliedAt: Date | null;
};

/**
 * A Campaign row with `status`/`source` narrowed, `config`/`summary` typed, and
 * the `startedAt`/`updatedAt`/`completedAt` Dates carried through as raw `Date`s
 * (Elysia serializes them on the wire).
 */
export type CampaignRow = Omit<
  Prisma.CampaignGetPayload<{}>,
  "config" | "summary" | "startedAt" | "updatedAt" | "completedAt"
> & {
  status: CampaignStatus;
  source: CampaignSource;
  config: CampaignConfig;
  summary: CampaignSummary;
  startedAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
};

/** The nested contact on an OutreachMessage row, with Dates carried through as raw `Date`s. */
type OutreachContactRow = Omit<
  Prisma.ContactGetPayload<{}>,
  "linkedinConnection" | "createdAt" | "updatedAt"
> & {
  linkedinConnection: ContactLinkedinConnection;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * An OutreachMessage row (with its contact) with `status`/`channel` and the nested
 * contact's `linkedinConnection` narrowed to the contract unions, and all Dates
 * (`sentAt`/`repliedAt`/`createdAt`/`updatedAt` plus the contact's) carried through
 * as raw `Date`s (Elysia serializes them on the wire).
 */
type OutreachMessageRow = Omit<
  Prisma.OutreachMessageGetPayload<{ include: { contact: true } }>,
  "sentAt" | "repliedAt" | "createdAt" | "updatedAt" | "contact"
> & {
  status: OutreachMessageStatus;
  channel: OutreachChannel;
  sentAt: Date | null;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contact: OutreachContactRow;
};

/** Serialize a Job row's `status`/Date fields to their wire shape. */
export function toCampaignJobRow(job: Prisma.JobGetPayload<{}>): CampaignJobRow {
  return {
    ...job,
    status: job.status as CampaignJobStatus,
    appliedAt: job.appliedAt,
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
    sentAt: message.sentAt,
    repliedAt: message.repliedAt,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    contact: {
      ...message.contact,
      linkedinConnection: message.contact.linkedinConnection as ContactLinkedinConnection,
      createdAt: message.contact.createdAt,
      updatedAt: message.contact.updatedAt,
    },
  };
}
