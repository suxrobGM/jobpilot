import type {
  ResumeData,
  resumeVariantCreateSchema,
  resumeVariantPatchSchema,
} from "@jobpilot/contracts/resume";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import type { z } from "zod/v4";
import { findOwned, notFound, unprocessable } from "@/common/errors";
import { renderResumePdf } from "@/common/pdf/render";
import { publish } from "@/common/sse";
import {
  deleteGeneratedVariantFiles,
  ensureCachedPdf,
  ensureGeneratedDir,
  generatedVariantPath,
  slugifyForDownload,
} from "@/common/storage/storage";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { backfillResumeIds } from "../backfill-ids";
import { streamFile } from "../resume.stream";
import { findResume } from "../resume.utils";
import type { VariantRewriteAudit } from "../rewrite";
import { notProtectedVariant } from "./prunable";
import { buildTailoredVariant, type TailorVariantBody } from "./tailor-variant";
import type { pruneVariantsQuerySchema } from "./variant.schema";

type ResumeVariantCreateInput = z.infer<typeof resumeVariantCreateSchema>;
type ResumeVariantPatch = z.infer<typeof resumeVariantPatchSchema>;
type PruneVariantsQuery = z.infer<typeof pruneVariantsQuerySchema>;

interface TailoredVariantResult {
  id: string;
  pdfUrl: string;
  rewordedBullets: number;
  flags: string[];
}

@singleton()
export class ResumeVariantService {
  constructor(private readonly prisma: PrismaClient) {}

  private findVariant(userId: string, id: string) {
    return findOwned(
      (where) =>
        this.prisma.resumeVariant.findFirst({
          where,
          include: { resume: { select: { label: true } } },
        }),
      { id, resume: { userId } },
      "Variant",
    );
  }

  private ownResume(userId: string, resumeId: string) {
    return findOwned(
      (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
      { id: resumeId, userId },
      "Resume",
    );
  }

  /** The link is the record of what was sent - a dangling id 404s rather than storing null. */
  private async assertApplicationExists(applicationId: string | null | undefined): Promise<void> {
    if (!applicationId) {
      return;
    }

    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    if (!app) {
      throw notFound("Application not found");
    }
  }

  /** Follows every delete path: the cache would otherwise keep files no request can reach. */
  private async afterVariantsDeleted(resumeId: string, ...ids: string[]): Promise<void> {
    await deleteGeneratedVariantFiles(...ids);
    publish(resumeChannel, { resumeId }, { type: "variant.deleted", resumeId, variantIds: ids });
  }

  async listVariants(userId: string, resumeId: string) {
    await this.ownResume(userId, resumeId);

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
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));
  }

  async createVariant(
    userId: string,
    resumeId: string,
    body: ResumeVariantCreateInput,
  ): Promise<{ id: string }> {
    await this.ownResume(userId, resumeId);
    await this.assertApplicationExists(body.applicationId);

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

    publish(
      resumeChannel,
      { resumeId },
      { type: "variant.created", resumeId, variantId: variant.id },
    );

    return { id: variant.id };
  }

  async getVariant(userId: string, id: string) {
    const variant = await this.findVariant(userId, id);

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
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }

  async updateVariant(
    userId: string,
    id: string,
    body: ResumeVariantPatch,
  ): Promise<{ id: string }> {
    await this.findVariant(userId, id);

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

  async removeVariant(userId: string, id: string): Promise<{ deleted: string }> {
    const variant = await this.findVariant(userId, id);
    await this.prisma.resumeVariant.delete({ where: { id } });
    await this.afterVariantsDeleted(variant.resumeId, id);
    return { deleted: id };
  }

  /**
   * Writes a variant's content onto its base and drops the variant - what the dashboard's Apply
   * does to a suggested rewrite. One transaction: as two browser calls, a dropped connection left
   * the base rewritten with the suggestion still on offer.
   */
  async applyVariant(userId: string, id: string): Promise<{ id: string; version: number }> {
    const variant = await this.findVariant(userId, id);
    const { resumeId } = variant;

    const [updated] = await this.prisma.$transaction([
      this.prisma.resume.update({
        where: { id: resumeId },
        // Content copied as stored: it went through `resumeDataSchema` when the variant was created.
        data: { content: variant.content, version: { increment: 1 } },
      }),
      this.prisma.resumeVariant.delete({ where: { id } }),
    ]);

    publish(
      resumeChannel,
      { resumeId },
      { type: "content.updated", resumeId, version: updated.version },
    );
    await this.afterVariantsDeleted(resumeId, id);

    return { id: updated.id, version: updated.version };
  }

  /**
   * Bulk prune for a base's accumulated variants. Never touches one linked to an application (the
   * record of what was sent) or a reserved label.
   */
  async pruneVariants(
    userId: string,
    resumeId: string,
    query: PruneVariantsQuery,
  ): Promise<{ deleted: number }> {
    await this.ownResume(userId, resumeId);

    const where: Prisma.ResumeVariantWhereInput = {
      resumeId,
      ...notProtectedVariant,
      ...(query.unlinkedOnly !== false && { applicationId: null }),
      ...(query.before && { createdAt: { lt: query.before } }),
    };

    // `keep` is applied by id rather than in the delete: "newest N survive" needs an ordered read.
    const candidates = await this.prisma.resumeVariant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: { id: true },
      ...(query.keep ? { skip: query.keep } : {}),
    });

    if (candidates.length === 0) {
      return { deleted: 0 };
    }

    const ids = candidates.map((variant) => variant.id);
    const result = await this.prisma.resumeVariant.deleteMany({ where: { id: { in: ids } } });
    await this.afterVariantsDeleted(resumeId, ...ids);

    return { deleted: result.count };
  }

  async renderVariantPdf(userId: string, variantId: string): Promise<Response> {
    const variant = await this.findVariant(userId, variantId);

    await ensureGeneratedDir();
    const cachePath = generatedVariantPath(variant.id, variant.updatedAt.getTime());
    await ensureCachedPdf(cachePath, () =>
      renderResumePdf(JSON.parse(variant.content) as ResumeData),
    );

    return streamFile(cachePath, "application/pdf", `${slugifyForDownload(variant.label)}.pdf`);
  }

  /**
   * Create a tailored variant from model-authored hints. The model writes prose and hint arrays,
   * never structured ResumeData - `buildTailoredVariant` applies them and rejects invented facts.
   */
  async createTailoredVariant(
    userId: string,
    resumeId: string,
    body: TailorVariantBody,
  ): Promise<TailoredVariantResult> {
    const base = await findResume(this.prisma, userId, resumeId);

    if (!base.content) {
      throw unprocessable("Base resume has no structured content. Run extract-resume first.");
    }
    await this.assertApplicationExists(body.applicationId);

    const { content: parsedBase } = backfillResumeIds(JSON.parse(base.content) as ResumeData);
    const tailored = buildTailoredVariant(parsedBase, body);

    const variant = await this.prisma.resumeVariant.create({
      data: {
        resumeId,
        label: body.label,
        jobUrl: body.jobUrl ?? null,
        applicationId: body.applicationId ?? null,
        content: JSON.stringify(tailored.content),
        diffNotes: body.diffNotes ?? null,
        rewrites: tailored.audit ? JSON.stringify(tailored.audit) : null,
      },
    });

    publish(
      resumeChannel,
      { resumeId },
      { type: "variant.created", resumeId, variantId: variant.id },
    );

    return {
      id: variant.id,
      pdfUrl: `/api/resumes/variants/${variant.id}/pdf`,
      rewordedBullets: tailored.rewordedBullets,
      flags: tailored.flags,
    };
  }
}
