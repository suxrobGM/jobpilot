import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** Result of replacing a resume's source file — id plus the new stored filename. */
export const sourceUploadedSchema = z.object({
  id: z.uuid(),
  sourceFilename: z.string(),
});

/** Result of deleting a resume's source file. */
export const sourceDeletedSchema = z.object({
  id: z.uuid(),
});
