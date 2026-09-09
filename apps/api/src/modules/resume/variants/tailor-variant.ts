import type { ResumeData } from "@jobpilot/contracts/resume";
import type { z } from "zod/v4";
import { unprocessable } from "@/common/errors";
import type { tailorResumeSchema } from "../resume.schema";
import { buildCorpus } from "../rewrite/facts";
import { validateHeadline, validateSummary } from "../rewrite/prose";
import { type EntryRewriteAudit, validateRewrites } from "../rewrite/rewrite";
import { applyStructure, type StructureAudit } from "../structure";
import { tailorBase } from "../tailor";

export type TailorVariantBody = z.infer<typeof tailorResumeSchema>;

/** Persisted shape for `ResumeVariant.rewrites` (stringified JSON). */
export interface VariantRewriteAudit {
  experience: EntryRewriteAudit[];
  /** Present only for variants that restructured sections. */
  structure?: StructureAudit;
}

export interface TailoredVariant {
  content: ResumeData;
  /** Null when nothing was reworded or restructured. */
  audit: VariantRewriteAudit | null;
  rewordedBullets: number;
  /** Soft review notes from the restructure stage. */
  flags: string[];
}

/**
 * Restructure, then validate rewrites against the *restructured* entries, then rank. Pure -
 * persistence and SSE stay in the service.
 */
export function buildTailoredVariant(base: ResumeData, body: TailorVariantBody): TailoredVariant {
  // All-or-nothing: a partially-applied restructure is a resume nobody asked for.
  const structure = body.structure ? applyStructure(base, body.structure) : null;
  if (structure && !structure.ok) {
    throw unprocessable("Structure validation failed", structure.violations);
  }

  const restructured = structure?.content ?? base;
  const corpus = buildCorpus(restructured);
  const summary = body.summary?.trim();
  const headline = body.headline?.trim();
  const prose = [
    ...(summary ? validateSummary(restructured.summary ?? "", summary, corpus) : []),
    ...(headline ? validateHeadline(headline, corpus) : []),
  ];
  if (prose.length > 0) {
    throw unprocessable("Prose validation failed", prose);
  }
  const rewrites = validateRewrites(restructured, body.bulletRewrites ?? [], corpus);
  if (!rewrites.ok) {
    throw unprocessable("Rewrite validation failed", rewrites.violations);
  }

  const content = tailorBase(restructured, {
    summary: body.summary,
    headline: body.headline,
    emphasizedTech: body.emphasizedTech,
    jobKeywords: body.jobKeywords,
    maxBulletsPerEntry: body.maxBulletsPerEntry,
    bulletRewrites: rewrites.map,
  });

  const rewordedBullets = rewrites.audit.reduce((n, entry) => n + entry.bullets.length, 0);
  const structureAudit = structure?.audit;

  return {
    content,
    audit:
      rewordedBullets > 0 || structureAudit
        ? { experience: rewrites.audit, ...(structureAudit && { structure: structureAudit }) }
        : null,
    rewordedBullets,
    flags: structureAudit?.flags ?? [],
  };
}
