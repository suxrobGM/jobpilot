import type {
  resumeVariantCreateSchema,
  resumeVariantPatchSchema,
} from "@jobpilot/contracts/resume";
import { inject, injectable } from "@needle-di/core";
import type { z } from "zod/v4";
import { findOwned, notFound, unprocessable } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { renderResumePdf } from "@/common/pdf/render";
import {
  deleteGeneratedVariantFiles,
  generatedVariantPath,
  serveCachedPdf,
} from "@/common/storage/storage";
import { normalizeJobUrl } from "@/common/utils/url";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { readContent, toStoredContent } from "../content";
import { publishResumeEvent } from "../resume.events";
import { ResumeService } from "../resume.service";
import { buildTailoredVariant } from "../tailoring/build-variant";
import {
  notProtectedVariant,
  type pruneVariantsQuerySchema,
  type TailorVariantBody,
  variantRewriteAuditSchema,
} from "./variant.schema";

type ResumeVariantCreateInput = z.infer<typeof resumeVariantCreateSchema>;
type ResumeVariantPatch = z.infer<typeof resumeVariantPatchSchema>;
type PruneVariantsQuery = z.infer<typeof pruneVariantsQuerySchema>;

@injectable()
export class ResumeVariantService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly resumes = inject(ResumeService),
  ) {}

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

  /** The link is the record of what was sent - a dangling id 404s rather than storing null. */
  private async assertApplicationOwned(
    userId: string,
    applicationId: string | null | undefined,
  ): Promise<void> {
    if (!applicationId) {
      return;
    }
    const app = await this.prisma.application.findFirst({
      where: { id: applicationId, userId },
      select: { id: true },
    });
    if (!app) {
      throw notFound("Application not found");
    }
  }

  private async create(
    userId: string,
    resumeId: string,
    data: Omit<Prisma.ResumeVariantUncheckedCreateInput, "resumeId">,
  ): Promise<string> {
    const jobUrl = data.jobUrl ? normalizeJobUrl(data.jobUrl) : data.jobUrl;
    const variant = await this.prisma.resumeVariant.create({ data: { ...data, jobUrl, resumeId } });
    publishResumeEvent(userId, { type: "variant.created", resumeId, variantId: variant.id });
    return variant.id;
  }

  /** Every delete path ends here: the cache would otherwise keep files no request can reach. */
  private async afterVariantsDeleted(
    userId: string,
    resumeId: string,
    ...ids: string[]
  ): Promise<void> {
    await deleteGeneratedVariantFiles(...ids);
    publishResumeEvent(userId, { type: "variant.deleted", resumeId, variantIds: ids });
  }

  async listVariants(userId: string, resumeId: string) {
    await this.resumes.findOwned(userId, resumeId);

    return this.prisma.resumeVariant.findMany({
      where: { resumeId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        resumeId: true,
        label: true,
        jobUrl: true,
        applicationId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createVariant(userId: string, resumeId: string, body: ResumeVariantCreateInput) {
    await this.resumes.findOwned(userId, resumeId);
    await this.assertApplicationOwned(userId, body.applicationId);

    const id = await this.create(userId, resumeId, {
      ...body,
      content: toStoredContent(body.content),
    });
    return { id };
  }

  /** The model sends prose and hints, never ResumeData; `buildTailoredVariant` rejects inventions. */
  async createTailoredVariant(userId: string, resumeId: string, body: TailorVariantBody) {
    const base = await this.resumes.findOwned(userId, resumeId);
    if (base.content === null) {
      throw unprocessable("Base resume has no structured content. Run extract-resume first.");
    }
    await this.assertApplicationOwned(userId, body.applicationId);

    const tailored = buildTailoredVariant(readContent(base.content), body);
    const id = await this.create(userId, resumeId, {
      label: body.label,
      jobUrl: body.jobUrl,
      applicationId: body.applicationId,
      changeNotes: body.changeNotes,
      content: toStoredContent(tailored.content),
      rewrites: tailored.audit ? toInputJson(tailored.audit) : undefined,
    });

    return {
      id,
      pdfUrl: `/api/resumes/variants/${id}/pdf`,
      rewordedBullets: tailored.rewordedBullets,
      flags: tailored.flags,
    };
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
      content: readContent(variant.content),
      changeNotes: variant.changeNotes,
      rewrites:
        variant.rewrites === null ? null : variantRewriteAuditSchema.parse(variant.rewrites),
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }

  async updateVariant(userId: string, id: string, body: ResumeVariantPatch) {
    await this.findVariant(userId, id);
    await this.assertApplicationOwned(userId, body.applicationId);

    await this.prisma.resumeVariant.update({
      where: { id },
      data: { ...body, content: body.content && toStoredContent(body.content) },
    });
    return { id };
  }

  async removeVariant(userId: string, id: string) {
    const variant = await this.findVariant(userId, id);
    await this.prisma.resumeVariant.delete({ where: { id } });
    await this.afterVariantsDeleted(userId, variant.resumeId, id);
    return { deleted: id };
  }

  /** One transaction: as two calls, a drop left the base rewritten and the suggestion on offer. */
  async applyVariant(userId: string, id: string) {
    const variant = await this.findVariant(userId, id);
    const { resumeId } = variant;

    const [updated] = await this.prisma.$transaction([
      this.prisma.resume.update({
        where: { id: resumeId },
        data: { content: toStoredContent(readContent(variant.content)), version: { increment: 1 } },
      }),
      this.prisma.resumeVariant.delete({ where: { id } }),
    ]);

    publishResumeEvent(userId, { type: "content.updated", resumeId, version: updated.version });
    await this.afterVariantsDeleted(userId, resumeId, id);

    return { id: resumeId, version: updated.version };
  }

  /** Never touches a variant linked to an application (the record of what was sent) or a reserved label. */
  async pruneVariants(userId: string, resumeId: string, query: PruneVariantsQuery) {
    await this.resumes.findOwned(userId, resumeId);

    // `keep` needs an ordered read: "newest N survive" cannot be said in a deleteMany.
    const candidates = await this.prisma.resumeVariant.findMany({
      where: {
        resumeId,
        ...notProtectedVariant,
        ...(query.unlinkedOnly !== false && { applicationId: null }),
        ...(query.before && { createdAt: { lt: query.before } }),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
      skip: query.keep,
    });
    if (candidates.length === 0) {
      return { deletedCount: 0 };
    }

    const ids = candidates.map((variant) => variant.id);
    const result = await this.prisma.resumeVariant.deleteMany({ where: { id: { in: ids } } });
    await this.afterVariantsDeleted(userId, resumeId, ...ids);

    return { deletedCount: result.count };
  }

  async renderVariantPdf(userId: string, id: string) {
    const variant = await this.findVariant(userId, id);
    return serveCachedPdf(
      generatedVariantPath(variant.id, variant.updatedAt.getTime()),
      () => renderResumePdf(readContent(variant.content)),
      variant.label,
    );
  }
}
