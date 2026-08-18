import { campaignSummarySchema } from "@jobpilot/contracts/campaign";
import {
  networkingChannelSchema,
  networkingMessageStatusSchema,
} from "@jobpilot/contracts/networking";
import { paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";
import { contactSchema } from "@/modules/contact/contact.schema";

/** Filters for the cross-campaign networking message list. */
export const networkingMessageQuerySchema = paginationQuerySchema.extend({
  status: networkingMessageStatusSchema.optional(),
  campaignId: z.uuid().optional(),
});

/**
 * A networking message with its contact (mirrors the mapper's `NetworkingMessageRow`).
 * `status`/`channel` are narrowed to the contract unions and all dates are
 * serialized to ISO.
 */
export const networkingMessageSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
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
  contact: contactSchema,
});

/** A list of networking messages (the `listNetworking` route). */
export const networkingMessageListSchema = paginatedSchema(networkingMessageSchema);

/**
 * Result of recording a networking message's terminal outcome - the updated
 * message and the current summary derived from message rows.
 */
export const networkingMessageResultResponseSchema = z.object({
  message: networkingMessageSchema,
  summary: campaignSummarySchema,
});
