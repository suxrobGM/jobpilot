import { campaignSummarySchema } from "@jobpilot/contracts/campaign";
import {
  contactLinkedinConnectionSchema,
  outreachChannelSchema,
  outreachMessageStatusSchema,
} from "@jobpilot/contracts/outreach";
import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** The nested contact on an outreach message (mirrors the mapper's `OutreachContactRow`). */
export const outreachContactSchema = z.object({
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
 * An outreach message with its contact (mirrors the mapper's `OutreachMessageRow`).
 * `status`/`channel` are narrowed to the contract unions and all dates are
 * serialized to ISO.
 */
export const outreachMessageSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  contactId: z.uuid(),
  campaignId: z.string().nullable(),
  channel: outreachChannelSchema,
  linkedinKind: z.string().nullable(),
  subject: z.string().nullable(),
  body: z.string(),
  status: outreachMessageStatusSchema,
  failReason: z.string().nullable(),
  providerId: z.string().nullable(),
  threadId: z.string().nullable(),
  sentAt: z.date().nullable(),
  repliedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  contact: outreachContactSchema,
});

/** A list of outreach messages (the `listOutreach` route). */
export const outreachMessageListSchema = z.array(outreachMessageSchema);

/**
 * Result of recording an outreach message's terminal outcome — the updated
 * message and the recomputed campaign summary.
 */
export const outreachMessageResultResponseSchema = z.object({
  message: outreachMessageSchema,
  summary: campaignSummarySchema,
});
