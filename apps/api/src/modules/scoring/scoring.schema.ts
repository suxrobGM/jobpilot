import { z } from "zod/v4";
import { ELIGIBILITY_RESTRICTION_KINDS } from "./eligibility";

/** Above this the digest is quoting a salary or a year, not counting experience. */
export const MAX_YEARS_EXPERIENCE = 50;

const jobDigestSchema = z.object({
  title: z.string().optional().default(""),
  company: z.string().optional().default(""),
  skills: z.array(z.string()).optional().default([]),
  requirements: z.array(z.string()).optional().default([]),
  responsibilities: z.array(z.string()).optional().default([]),
  yearsExperience: z.number().int().min(0).max(MAX_YEARS_EXPERIENCE).nullable().optional(),
  descriptionExcerpt: z.string().optional().default(""),
});

export type JobDigest = z.infer<typeof jobDigestSchema>;

const fitProfileSchema = z.object({
  skills: z.array(z.string()).default([]),
  yearsExperience: z.number().int().min(0).max(MAX_YEARS_EXPERIENCE).nullable().default(null),
  /** Defaults from the profile; only then does the posting's work-authorization language matter. */
  requiresSponsorship: z.boolean().default(false),
});

export type FitProfile = z.infer<typeof fitProfileSchema>;

export const scoreFitSchema = z.object({
  digest: jobDigestSchema,
  profile: fitProfileSchema.partial().optional(),
  // Base resume to derive fit inputs from; falls back to the profile's primary.
  resumeId: z.uuid().optional(),
  // Threshold the verdict is measured against; defaults to the user's auto-apply minimum.
  minScore: z.number().int().min(0).max(100).optional(),
});

/** Deterministic keyword-overlap fit result returned by `scoreJobFit`. */
export const fitResultSchema = z.object({
  score: z.number(),
  confidence: z.number(),
  strongMatches: z.array(z.string()),
  partialMatches: z.array(z.string()),
  gaps: z.array(z.string()),
  verdict: z.enum(["trust", "deliberate"]),
  eligibilityBlocked: z
    .object({ kind: z.enum(ELIGIBILITY_RESTRICTION_KINDS), evidence: z.string() })
    .optional(),
});
