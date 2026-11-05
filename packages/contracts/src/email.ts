import { z } from "zod/v4";
import { type ApplicationStatus, statusSchema } from "./application";

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
  applicationId: z.uuid().optional().nullable(),
  matchConfidence: z.number().min(0).max(1).optional().nullable(),
  resultingStatus: statusSchema.optional().nullable(),
  reviewStatus: reviewStatusSchema.optional(),
  verificationCode: z.string().optional().nullable(),
  verificationLink: z.string().optional().nullable(),
  verificationDomain: z.string().optional().nullable(),
});

export const approveSchema = z.object({
  toStatus: statusSchema.optional(),
  note: z.string().optional().nullable(),
});

/** Every reason the Gmail connect callback redirects back with (`?emailConnect=error&reason=`). */
const EMAIL_CONNECT_ERROR_REASONS = [
  "access_denied",
  /** Missing code or state, or the state cookie did not match. */
  "invalid_callback",
  /** Google's consent screen let the user drop the read scope. */
  "scope_not_granted",
  /** Google rejected the code or returned unusable tokens. */
  "provider_error",
  "unexpected",
] as const;
export type EmailConnectErrorReason = (typeof EMAIL_CONNECT_ERROR_REASONS)[number];

/**
 * Upsert the user's own Google OAuth client. `clientSecret` is optional so an
 * edit can leave it blank to keep the stored one; the service requires it on
 * first create.
 */
export const oauthClientUpsertSchema = z.object({
  clientId: z.string().trim().min(1, "Client ID is required"),
  clientSecret: z.string().optional(),
});

export type Classification = z.infer<typeof classificationSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type ScanMessageInput = z.infer<typeof scanMessageSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
export type OAuthClientUpsertInput = z.infer<typeof oauthClientUpsertSchema>;
