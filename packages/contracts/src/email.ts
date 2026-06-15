import { z } from "zod/v4";

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

export const REVIEW_STATUSES = ["pending", "approved", "denied", "auto"] as const;
export const reviewStatusSchema = z.enum(REVIEW_STATUSES);

export const scanMessageSchema = z.object({
  classification: classificationSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
  matchedAppId: z.number().int().optional().nullable(),
  matchScore: z.number().min(0).max(1).optional().nullable(),
  appliedStage: z.string().optional().nullable(),
  reviewStatus: reviewStatusSchema.optional(),
  verificationCode: z.string().optional().nullable(),
  verificationLink: z.string().optional().nullable(),
  verificationDomain: z.string().optional().nullable(),
});

export const approveSchema = z.object({
  toStage: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
});

export type EmailProviderName = z.infer<typeof emailProviderSchema>;
export type Classification = z.infer<typeof classificationSchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type ScanMessageInput = z.infer<typeof scanMessageSchema>;
export type ApproveInput = z.infer<typeof approveSchema>;
