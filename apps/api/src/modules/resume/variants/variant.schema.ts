import { resumeDataSchema } from "@jobpilot/contracts/resume";
import { z } from "zod/v4";

/**
 * Bulk-prune filters. All optional, and `unlinkedOnly` defaults on: a bare call sweeps only the
 * variants nothing points at, which is the safe reading of "clean up the accumulated ones".
 */
export const pruneVariantsQuerySchema = z.object({
  /** Only variants created strictly before this instant. */
  before: z.coerce.date().optional(),
  /** Keep this many newest matches. */
  keep: z.coerce.number().int().min(0).max(100).optional(),
  /** Set false to include variants linked to an application. */
  unlinkedOnly: z.stringbool().optional(),
});

/** Result of a bulk prune. */
export const prunedResponseSchema = z.object({ deleted: z.number().int() });

/** Per-bullet rewrite audit (mirrors `BulletRewriteAudit`). */
const bulletRewriteAuditSchema = z.object({
  original: z.string(),
  tailored: z.string(),
  flags: z.array(z.string()),
});

/** Per-entry rewrite audit (mirrors `EntryRewriteAudit`). */
const entryRewriteAuditSchema = z.object({
  entryIndex: z.number().int(),
  company: z.string(),
  bullets: z.array(bulletRewriteAuditSchema),
});

/** Structural changes applied by a variant (mirrors `StructureAudit`). */
const structureAuditSchema = z.object({
  merged: z.array(
    z.object({
      company: z.string(),
      absorbed: z.array(z.string()),
      start: z.string(),
      end: z.string(),
    }),
  ),
  dropped: z.array(z.string()),
  promoted: z.array(
    z.object({
      company: z.string(),
      projects: z.array(z.string()),
      start: z.string(),
      end: z.string(),
    }),
  ),
  reordered: z.boolean(),
  retitled: z.array(z.object({ company: z.string(), from: z.string(), to: z.string() })),
  flags: z.array(z.string()),
});

/** Persisted `ResumeVariant.rewrites` shape (mirrors `VariantRewriteAudit`). */
const variantRewriteAuditSchema = z.object({
  experience: z.array(entryRewriteAuditSchema),
  structure: structureAuditSchema.optional(),
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
