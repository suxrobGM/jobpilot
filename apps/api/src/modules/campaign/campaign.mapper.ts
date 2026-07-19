import type {
  CampaignConfig,
  CampaignJobStatus,
  CampaignSource,
  CampaignStatus,
  CampaignSummary,
} from "@jobpilot/contracts/campaign";
import type {
  contactLinkedinConnectionSchema,
  NetworkingChannel,
  NetworkingMessageStatus,
} from "@jobpilot/contracts/networking";
import type { z } from "zod/v4";
import type { Campaign, Contact, Job, Prisma } from "@/generated/prisma/client";

/** Contact connection-state union - derived from the contract schema. */
type ContactLinkedinConnection = z.infer<typeof contactLinkedinConnectionSchema>;

/**
 * A Job row with `status` narrowed to the campaign job-status union and the
 * `appliedAt` Date carried through as a raw `Date` (Elysia serializes it on the wire).
 */
export type CampaignJobRow = Omit<Job, "appliedAt"> & {
  status: CampaignJobStatus;
  appliedAt: Date | null;
};

/**
 * A Campaign row with `status`/`source` narrowed, `config`/`summary` typed, and
 * the `startedAt`/`updatedAt`/`completedAt` Dates carried through as raw `Date`s
 * (Elysia serializes them on the wire).
 */
export type CampaignRow = Omit<
  Campaign,
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

/** The nested contact on a NetworkingMessage row, with Dates carried through as raw `Date`s. */
type NetworkingContactRow = Omit<Contact, "linkedinConnection" | "createdAt" | "updatedAt"> & {
  linkedinConnection: ContactLinkedinConnection;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * A NetworkingMessage row (with its contact) with `status`/`channel` and the nested
 * contact's `linkedinConnection` narrowed to the contract unions, and all Dates
 * (`sentAt`/`repliedAt`/`createdAt`/`updatedAt` plus the contact's) carried through
 * as raw `Date`s (Elysia serializes them on the wire).
 */
type NetworkingMessageRow = Omit<
  Prisma.NetworkingMessageGetPayload<{ include: { contact: true } }>,
  "sentAt" | "repliedAt" | "createdAt" | "updatedAt" | "contact"
> & {
  status: NetworkingMessageStatus;
  channel: NetworkingChannel;
  sentAt: Date | null;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  contact: NetworkingContactRow;
};

/** Serialize a Job row's `status`/Date fields to their wire shape. */
export function toCampaignJobRow(job: Job): CampaignJobRow {
  return {
    ...job,
    status: job.status as CampaignJobStatus,
    appliedAt: job.appliedAt,
  };
}

/** Serialize a NetworkingMessage row (with contact) to its wire shape. */
export function toNetworkingMessageRow(
  message: Prisma.NetworkingMessageGetPayload<{ include: { contact: true } }>,
): NetworkingMessageRow {
  return {
    ...message,
    status: message.status as NetworkingMessageStatus,
    channel: message.channel as NetworkingChannel,
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
