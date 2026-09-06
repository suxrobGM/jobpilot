import { z } from "zod/v4";
import { type ApplicationStatus, statusSchema } from "./application";

export const EMAIL_PROVIDERS = ["gmail", "outlook", "imap"] as const;
export const emailProviderSchema = z.enum(EMAIL_PROVIDERS);

export const CLASSIFICATIONS = [
  "interviewing",
  "rejected",
  "offer",
  "irrelevant",
  "verification",
] as const;
export const classificationSchema = z.enum(CLASSIFICATIONS);

/** Maps an approvable inbox classification to the application status it moves to. */
export const CLASSIFICATION_TO_STATUS: Partial<Record<Classification, ApplicationStatus>> = {
  interviewing: "interviewing",
  rejected: "rejected",
  offer: "offer",
};

export const REVIEW_STATUSES = ["pending", "approved", "denied", "auto"] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);

export const scanMessageSchema = z.object({
  classification: classificationSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
  matchedAppId: z.uuid().optional().nullable(),
  matchScore: z.number().min(0).max(1).optional().nullable(),
  appliedStatus: statusSchema.optional().nullable(),
  reviewStatus: reviewStatusSchema.optional(),
  verificationCode: z.string().optional().nullable(),
  verificationLink: z.string().optional().nullable(),
  verificationDomain: z.string().optional().nullable(),
});

export const approveSchema = z.object({
  toStatus: statusSchema.optional(),
  note: z.string().optional().nullable(),
});

/**
 * Upsert the user's own Google OAuth client. `clientSecret` is optional so an
 * edit can leave it blank to keep the stored one; the service requires it on
 * first create.
 */
export const oauthClientUpsertSchema = z.object({
  provider: emailProviderSchema.optional(),
  clientId: z.string().trim().min(1, "Client ID is required"),
  clientSecret: z.string().optional(),
});

export type Classification = z.infer<typeof classificationSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type ScanMessageInput = z.infer<typeof scanMessageSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
export type OAuthClientUpsertInput = z.infer<typeof oauthClientUpsertSchema>;
