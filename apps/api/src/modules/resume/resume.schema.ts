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

/** A resume contact field that disagrees with the profile the form-filler submits. */
const profileMismatchSchema = z.object({
  field: z.enum(["location", "email", "phone", "linkedin", "github", "website"]),
  resume: z.string(),
  profile: z.string(),
});

/** A single master resume with its structured content and source metadata. */
export const resumeDetailSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  label: z.string(),
  content: resumeDataSchema.nullable(),
  version: z.number().int(),
  sourceFilename: z.string().nullable(),
  sourceMimeType: z.string().nullable(),
  sourceSizeBytes: z.number().int().nullable(),
  isPrimary: z.boolean(),
  profileMismatches: z.array(profileMismatchSchema),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Result of updating a resume - id plus the bumped version. */
export const resumeUpdatedSchema = z.object({
  id: z.uuid(),
  version: z.number().int(),
});

/**
 * Structural changes. Every index refers to the *base* resume, so a plan needs no simulation of
 * intermediate states. Dates and employer names are derived or whitelisted in `structure.ts`.
 */
export const resumeStructureSchema = z.object({
  entryOrder: z.array(z.number().int().min(0)).optional(),
  dropEntries: z.array(z.number().int().min(0)).optional(),
  mergeEntries: z
    .array(
      z.object({
        /** The entry that absorbs the others and keeps its position. */
        into: z.number().int().min(0),
        /** Merged into `into`, then removed. */
        from: z.array(z.number().int().min(0)).min(1),
        /** Must be one of the merged employers or an umbrella name; `structure.ts` enforces it. */
        company: z.string().min(1).optional(),
        title: z.string().min(1).optional(),
      }),
    )
    .optional(),
  projectOrder: z.array(z.number().int().min(0)).optional(),
  promoteProjects: z
    .object({
      /** Lifted into one synthesized experience entry, dated from the projects themselves. */
      projects: z.array(z.number().int().min(0)).min(1),
      /** Umbrella names only - a promoted project has no employer by definition. */
      company: z.string().min(1).optional(),
      title: z.string().min(1).optional(),
    })
    .optional(),
});

export const tailorResumeSchema = z.object({
  label: z.string().min(1),
  jobUrl: z.url().optional().nullable(),
  applicationId: z.uuid().optional().nullable(),
  summary: z.string().optional(),
  headline: z.string().optional(),
  emphasizedTech: z.array(z.string()).optional(),
  jobKeywords: z.array(z.string()).optional(),
  diffNotes: z.string().optional().nullable(),
  maxBulletsPerEntry: z.number().int().min(1).max(20).optional(),
  structure: resumeStructureSchema.optional(),
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
