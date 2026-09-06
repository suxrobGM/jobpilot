import { paginatedSchema } from "@jobpilot/contracts/pagination";
import { z } from "zod/v4";

export const pdfRequestSchema = z.object({
  text: z.string().min(1),
  name: z.string().optional(),
});

// Response schemas

/** Where a cover letter originated (mirrors `coverLetterSourceSchema`). */
const coverLetterSource = z.enum(["apply", "auto-apply", "manual"]);

/** A row in the cover-letter list (metadata only - no letter body). */
const coverLetterSummarySchema = z.object({
  id: z.uuid(),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  jobUrl: z.string().nullable(),
  source: coverLetterSource,
  createdAt: z.date(),
});

export const coverLetterListSchema = paginatedSchema(coverLetterSummarySchema);

/** A single saved cover letter with its full plain-text body. */
export const coverLetterDetailSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  jobUrl: z.string().nullable(),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  source: coverLetterSource,
  content: z.string(),
  createdAt: z.date(),
});

/**
 * The newly created cover letter - the raw Prisma row is returned, so `source`
 * is the un-narrowed column `string` and `createdAt` is a `Date` (serialized to
 * an ISO string on the wire).
 */
export const coverLetterCreatedSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  jobUrl: z.string().nullable(),
  jobTitle: z.string().nullable(),
  company: z.string().nullable(),
  source: z.string(),
  content: z.string(),
  createdAt: z.date(),
});
