import { z } from "zod/v4";

/** The catalog key. Lower-cased so `LinkedIn.com` and `linkedin.com` are one board. */
const boardDomain = z.string().trim().toLowerCase().min(1);

/**
 * Links a catalog board to the profile by domain. An unknown domain is added to the catalog
 * unlisted, named by `name` (or the domain itself). Logins are credentials scoped to the domain.
 */
export const jobBoardSchema = z.object({
  domain: boardDomain,
  name: z.string().trim().optional(),
  searchUrl: z.string().trim().optional(),
});

/** A global catalog row. */
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
export type AdminBoardInput = z.infer<typeof adminBoardSchema>;
export type AdminBoardPatch = z.infer<typeof adminBoardPatchSchema>;
