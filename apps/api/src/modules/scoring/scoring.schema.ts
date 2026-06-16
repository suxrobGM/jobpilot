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
});
