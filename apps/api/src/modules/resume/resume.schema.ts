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
