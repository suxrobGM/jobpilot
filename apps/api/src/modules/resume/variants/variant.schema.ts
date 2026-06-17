import { resumeDataSchema } from "@jobpilot/contracts/resume";
import { z } from "zod/v4";

// ── Response schemas ──────────────────────────────────────────────────────────

/** Per-bullet rewrite audit (mirrors `BulletRewriteAudit`). */
export const bulletRewriteAuditSchema = z.object({
  original: z.string(),
  tailored: z.string(),
  flags: z.array(z.string()),
});

/** Per-entry rewrite audit (mirrors `EntryRewriteAudit`). */
export const entryRewriteAuditSchema = z.object({
  entryIndex: z.number().int(),
  company: z.string(),
  bullets: z.array(bulletRewriteAuditSchema),
});

/** Persisted `ResumeVariant.rewrites` shape (mirrors `VariantRewriteAudit`). */
export const variantRewriteAuditSchema = z.object({
  experience: z.array(entryRewriteAuditSchema),
});

/** A row in a resume's variant list. */
export const variantSummarySchema = z.object({
  id: z.uuid(),
  resumeId: z.uuid(),
  label: z.string(),
  jobUrl: z.string().nullable(),
  applicationId: z.uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const variantListSchema = z.array(variantSummarySchema);

/** A single tailored variant with parsed content, diff notes, and rewrite audit. */
export const variantDetailSchema = z.object({
  id: z.uuid(),
  resumeId: z.uuid(),
  resumeLabel: z.string(),
  label: z.string(),
  jobUrl: z.string().nullable(),
  applicationId: z.uuid().nullable(),
  content: resumeDataSchema,
  diffNotes: z.string().nullable(),
  rewrites: variantRewriteAuditSchema.nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/** Result of deterministically tailoring a variant from model hints. */
export const tailoredVariantSchema = z.object({
  id: z.uuid(),
  pdfUrl: z.string(),
  rewordedBullets: z.number().int(),
  flags: z.array(z.string()),
});
