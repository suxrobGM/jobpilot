import type {
  ResumeData,
  resumeVariantCreateSchema,
  resumeVariantPatchSchema,
} from "@jobpilot/contracts/resume";
import { singleton } from "tsyringe";
import type { z } from "zod/v4";
import { ErrorCodes, findOwned, HttpError, notFound } from "@/common/errors";
import { renderResumePdf } from "@/common/pdf";
import {
  ensureCachedPdf,
  ensureGeneratedDir,
  generatedVariantPath,
  slugifyForDownload,
} from "@/common/storage";
import { PrismaClient } from "@/generated/prisma/client";
import { backfillResumeIds } from "../backfill-ids";
import { streamFile } from "../resume.stream";
import { findResume } from "../resume.utils";
import { validateRewrites, type VariantRewriteAudit } from "../rewrite";
import { tailorBase } from "../tailor";

type ResumeVariantCreateInput = z.infer<typeof resumeVariantCreateSchema>;
type ResumeVariantPatch = z.infer<typeof resumeVariantPatchSchema>;

export interface TailorVariantBody {
  label: string;
  jobUrl?: string | null;
  applicationId?: string | null;
  summary?: string;
  emphasizedTech?: string[];
  jobKeywords?: string[];
  diffNotes?: string | null;
  maxBulletsPerEntry?: number;
  rewordTopN?: number;
  bulletRewrites?: { entryIndex: number; bullets: { original: string; tailored: string }[] }[];
}

interface TailoredVariantResult {
  id: string;
  pdfUrl: string;
  rewordedBullets: number;
  flags: string[];
}

@singleton()
export class ResumeVariantService {
  constructor(private readonly prisma: PrismaClient) {}

  private findVariant(profileId: string, id: string) {
    return findOwned(
      (where) =>
        this.prisma.resumeVariant.findFirst({
          where,
          include: { resume: { select: { label: true } } },
        }),
      { id, resume: { profileId } },
      "Variant",
    );
  }

  async listVariants(profileId: string, resumeId: string) {
    await findOwned(
      (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
      { id: resumeId, profileId },
      "Resume",
    );

    const variants = await this.prisma.resumeVariant.findMany({
      where: { resumeId },
      orderBy: { updatedAt: "desc" },
    });

    return variants.map((v) => ({
      id: v.id,
      resumeId: v.resumeId,
      label: v.label,
      jobUrl: v.jobUrl,
      applicationId: v.applicationId,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
    }));
  }

  async createVariant(
    profileId: string,
    resumeId: string,
    body: ResumeVariantCreateInput,
  ): Promise<{ id: string }> {
    await findOwned(
      (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
      { id: resumeId, profileId },
      "Resume",
    );

    if (body.applicationId) {
      const app = await this.prisma.application.findUnique({
        where: { id: body.applicationId },
        select: { id: true },
      });
      if (!app) {
        throw notFound("Application not found");
      }
    }

    const variant = await this.prisma.resumeVariant.create({
      data: {
        resumeId,
        label: body.label,
        jobUrl: body.jobUrl ?? null,
        applicationId: body.applicationId ?? null,
        content: JSON.stringify(body.content),
        diffNotes: body.diffNotes ?? null,
      },
    });

    return { id: variant.id };
  }

  async getVariant(profileId: string, id: string) {
    const variant = await this.findVariant(profileId, id);

    return {
      id: variant.id,
      resumeId: variant.resumeId,
      resumeLabel: variant.resume.label,
      label: variant.label,
      jobUrl: variant.jobUrl,
      applicationId: variant.applicationId,
      content: JSON.parse(variant.content) as ResumeData,
      diffNotes: variant.diffNotes,
      rewrites: variant.rewrites ? (JSON.parse(variant.rewrites) as VariantRewriteAudit) : null,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    };
  }

  async updateVariant(
    profileId: string,
    id: string,
    body: ResumeVariantPatch,
  ): Promise<{ id: string }> {
    await this.findVariant(profileId, id);

    const updated = await this.prisma.resumeVariant.update({
      where: { id },
      data: {
        label: body.label ?? undefined,
        jobUrl: body.jobUrl === undefined ? undefined : body.jobUrl,
        applicationId: body.applicationId === undefined ? undefined : body.applicationId,
        content: body.content ? JSON.stringify(body.content) : undefined,
        diffNotes: body.diffNotes === undefined ? undefined : body.diffNotes,
      },
    });
    return { id: updated.id };
  }

  async removeVariant(profileId: string, id: string): Promise<{ deleted: string }> {
    await this.findVariant(profileId, id);
    await this.prisma.resumeVariant.delete({ where: { id } });
    return { deleted: id };
  }

  async renderVariantPdf(profileId: string, variantId: string): Promise<Response> {
    const variant = await findOwned(
      (where) => this.prisma.resumeVariant.findFirst({ where }),
      { id: variantId, resume: { profileId } },
      "Variant",
    );

    await ensureGeneratedDir();
    const cachePath = generatedVariantPath(variant.id, variant.updatedAt.getTime());
    await ensureCachedPdf(cachePath, () =>
      renderResumePdf(JSON.parse(variant.content) as ResumeData),
    );

    return streamFile(cachePath, "application/pdf", `${slugifyForDownload(variant.label)}.pdf`);
  }

  /**
   * Create a tailored resume variant from model-authored hints. The model
   * never writes structured ResumeData — just a tailored `summary` and a
   * small `emphasizedTech`/`jobKeywords` array. The server applies a
   * deterministic ranking against the base content.
   */
  async createTailoredVariant(
    profileId: string,
    resumeId: string,
    body: TailorVariantBody,
  ): Promise<TailoredVariantResult> {
    const base = await findResume(this.prisma, profileId, resumeId);

    if (!base.content) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        "Base resume has no structured content. Run extract-resume first.",
        422,
      );
    }

    if (body.applicationId) {
      const app = await this.prisma.application.findUnique({
        where: { id: body.applicationId },
        select: { id: true },
      });
      if (!app) {
        throw notFound("Application not found");
      }
    }

    const { content: baseContent } = backfillResumeIds(JSON.parse(base.content) as ResumeData);

    const rewordTopN = body.rewordTopN ?? 2;
    const rewrites = body.bulletRewrites ?? [];
    const validation = validateRewrites(baseContent, rewrites, rewordTopN);

    if (!validation.ok) {
      throw new HttpError(
        ErrorCodes.UNPROCESSABLE,
        "Rewrite validation failed",
        422,
        validation.violations,
      );
    }

    const tailored = tailorBase(baseContent, {
      summary: body.summary,
      emphasizedTech: body.emphasizedTech,
      jobKeywords: body.jobKeywords,
      maxBulletsPerEntry: body.maxBulletsPerEntry,
      bulletRewrites: validation.map,
      rewordTopN,
    });

    const rewordedBullets = validation.audit.reduce((n, e) => n + e.bullets.length, 0);
    const flags = validation.audit.flatMap((e) => e.bullets.flatMap((b) => b.flags));

    const variant = await this.prisma.resumeVariant.create({
      data: {
        resumeId,
        label: body.label,
        jobUrl: body.jobUrl ?? null,
        applicationId: body.applicationId ?? null,
        content: JSON.stringify(tailored),
        diffNotes: body.diffNotes ?? null,
        rewrites: rewordedBullets > 0 ? JSON.stringify({ experience: validation.audit }) : null,
      },
    });

    return {
      id: variant.id,
      pdfUrl: `/api/resumes/variants/${variant.id}/pdf`,
      rewordedBullets,
      flags,
    };
  }
}
