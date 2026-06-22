import { z } from "zod/v4";

export const jobDigestSchema = z.object({
  title: z.string().optional().default(""),
  company: z.string().optional().default(""),
  techStack: z.array(z.string()).optional().default([]),
  requirements: z.array(z.string()).optional().default([]),
  responsibilities: z.array(z.string()).optional().default([]),
  yearsExperience: z.number().int().min(0).max(50).nullable().optional(),
  descriptionExcerpt: z.string().optional().default(""),
});

export type JobDigest = z.infer<typeof jobDigestSchema>;

export const fitProfileSchema = z.object({
  techStack: z.array(z.string()).default([]),
  yearsExperience: z.number().int().min(0).max(50).nullable().default(null),
});

export type FitProfile = z.infer<typeof fitProfileSchema>;

export const scoreFitSchema = z.object({
  digest: jobDigestSchema,
  profile: fitProfileSchema.partial().optional(),
  // Base resume to derive fit inputs from; falls back to the profile's primary.
  resumeId: z.uuid().optional(),
});

// ── Response schemas ──────────────────────────────────────────────────────────

/** Deterministic keyword-overlap fit result returned by `scoreJobFit`. */
export const fitResultSchema = z.object({
  score: z.number(),
  confidence: z.number(),
  strongMatches: z.array(z.string()),
  partialMatches: z.array(z.string()),
  gaps: z.array(z.string()),
});
