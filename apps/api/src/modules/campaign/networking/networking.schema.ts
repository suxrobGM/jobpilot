import { campaignSummarySchema } from "@jobpilot/contracts/campaign";
import {
  contactLinkedinConnectionSchema,
  networkingChannelSchema,
  networkingMessageStatusSchema,
} from "@jobpilot/contracts/networking";
import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** The nested contact on a networking message (mirrors the mapper's `NetworkingContactRow`). */
export const networkingContactSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  name: z.string(),
  title: z.string().nullable(),
  company: z.string().nullable(),
  linkedinUrl: z.string().nullable(),
  email: z.string().nullable(),
  emailSource: z.string().nullable(),
  emailConfidence: z.number().nullable(),
  linkedinConnection: contactLinkedinConnectionSchema,
  discoverySource: z.string().nullable(),
  matchConfidence: z.number().nullable(),
  relatedAppId: z.string().nullable(),
  relatedJobUrl: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * A networking message with its contact (mirrors the mapper's `NetworkingMessageRow`).
 * `status`/`channel` are narrowed to the contract unions and all dates are
 * serialized to ISO.
 */
export const networkingMessageSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  contactId: z.uuid(),
  campaignId: z.string().nullable(),
  channel: networkingChannelSchema,
  linkedinKind: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string(),
  status: networkingMessageStatusSchema,
  failReason: z.string().nullable(),
  providerId: z.string().nullable(),
  threadId: z.string().nullable(),
  sentAt: z.date().nullable(),
  repliedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  contact: networkingContactSchema,
});

/** A list of networking messages (the `listNetworking` route). */
export const networkingMessageListSchema = z.array(networkingMessageSchema);

/**
 * Result of recording a networking message's terminal outcome - the updated
 * message and the recomputed campaign summary.
 */
export const networkingMessageResultResponseSchema = z.object({
  message: networkingMessageSchema,
  summary: campaignSummarySchema,
});
