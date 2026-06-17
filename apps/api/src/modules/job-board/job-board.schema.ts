import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** A saved job board owned by a profile (the `JobBoard` row with `password` decrypted). */
export const jobBoardRecordSchema = z.object({
  id: z.uuid(),
  profileId: z.uuid(),
  name: z.string(),
  domain: z.string(),
  searchUrl: z.string().nullable(),
  email: z.string().nullable(),
  password: z.string().nullable(),
  sortOrder: z.number().int(),
});

/** All of the active profile's job boards, ordered by sort order. */
export const jobBoardListSchema = z.array(jobBoardRecordSchema);
