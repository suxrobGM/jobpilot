import { resumeDataSchema } from "@jobpilot/contracts/resume";
import { z } from "zod/v4";

export const createResumeSchema = z.object({
  label: z.string().min(1),
  content: resumeDataSchema.optional(),
});

export const updateResumeSchema = z.object({
  label: z.string().min(1).optional(),
  content: resumeDataSchema.optional(),
});

// ── Response schemas ──────────────────────────────────────────────────────────

/** A row in the master-resume list. */
export const resumeSummarySchema = z.object({
  id: z.uuid(),
  label: z.string(),
  sourceFilename: z.string().nullable(),
  hasData: z.boolean(),
  variantCount: z.number().int(),
  isPrimary: z.boolean(),
  updatedAt: z.date(),
});

export const resumeListSchema = z.array(resumeSummarySchema);

/** A single master resume with its structured content and source metadata. */
export const resumeDetailSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  label: z.string(),
  content: resumeDataSchema.nullable(),
  version: z.number().int(),
  sourceFilename: z.string().nullable(),
  sourceMimeType: z.string().nullable(),
  sourceSizeBytes: z.number().int().nullable(),
  isPrimary: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Result of updating a resume — id plus the bumped version. */
export const resumeUpdatedSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
});

export const tailorResumeSchema = z.object({
  label: z.string().min(1),
  jobUrl: z.url().optional().nullable(),
  applicationId: z.uuid().optional().nullable(),
  summary: z.string().optional(),
  emphasizedTech: z.array(z.string()).optional(),
  jobKeywords: z.array(z.string()).optional(),
  diffNotes: z.string().optional().nullable(),
  maxBulletsPerEntry: z.number().int().min(1).max(20).optional(),
  rewordTopN: z.number().int().min(0).max(3).optional(),
  bulletRewrites: z
    .array(
      z.object({
        entryIndex: z.number().int().min(0),
        bullets: z
          .array(z.object({ original: z.string().min(1), tailored: z.string().min(1) }))
          .min(1),
      }),
    )
    .optional(),
});
