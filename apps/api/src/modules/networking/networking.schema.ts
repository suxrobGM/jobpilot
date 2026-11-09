import {
  networkingChannelSchema,
  networkingMessageStatusSchema,
} from "@jobpilot/contracts/networking";
import { paginatedSchema, paginationQuerySchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";
import { contactSchema } from "@/modules/contact/contact.schema";

export const networkingMessageParams = z.object({ id: z.uuid(), messageId: z.uuid() });

export const networkingMessageQuerySchema = paginationQuerySchema.extend({
  status: networkingMessageStatusSchema.optional(),
  feedId: z.uuid().optional(),
});

export const networkingMessageSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  contactId: z.uuid(),
  feedId: z.string().nullable(),
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

export const networkingMessageListSchema = paginatedSchema(networkingMessageSchema);

export const networkingMessageResultResponseSchema = z.object({
  message: networkingMessageSchema,
});
