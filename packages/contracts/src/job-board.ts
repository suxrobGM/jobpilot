import { z } from "zod/v4";

/** The catalog key. Lower-cased so `LinkedIn.com` and `linkedin.com` are one board. */
const boardDomain = z.string().trim().toLowerCase().min(1);

/**
 * Links a catalog board to the profile by domain. An unknown domain is added to the catalog
 * unlisted, named by `name` (or the domain itself). Only the login is stored per profile.
 */
export const jobBoardSchema = z.object({
  domain: boardDomain,
  name: z.string().trim().optional(),
  searchUrl: z.string().trim().optional(),
  email: z.string().trim().optional(),
  password: z.string().optional(),
});

/** Omit a field to keep it; send null or an empty string to clear it. */
export const jobBoardPatchSchema = z.object({
  email: z.string().trim().nullable().optional(),
  password: z.string().nullable().optional(),
});

/** A global catalog row. Credentials live on the per-profile link, never here. */
export const adminBoardSchema = z.object({
  name: z.string().min(1),
  domain: boardDomain,
  searchUrl: z.string().optional().nullable(),
  listed: z.boolean(),
  isDefault: z.boolean(),
  sortOrder: z.number().int(),
});

export const adminBoardPatchSchema = adminBoardSchema.partial();

export type JobBoardInput = z.infer<typeof jobBoardSchema>;
export type JobBoardPatch = z.infer<typeof jobBoardPatchSchema>;
export type AdminBoardInput = z.infer<typeof adminBoardSchema>;
export type AdminBoardPatch = z.infer<typeof adminBoardPatchSchema>;
