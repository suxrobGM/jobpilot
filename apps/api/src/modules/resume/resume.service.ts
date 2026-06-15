import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  ResumeData,
  resumeVariantCreateSchema,
  resumeVariantPatchSchema,
} from "@jobpilot/contracts/resume";
import { singleton } from "tsyringe";
import type { z } from "zod/v4";
import {
  badRequest,
  ErrorCodes,
  findOwned,
  HttpError,
  notFound,
} from "@/common/errors";
import { renderResumePdf } from "@/common/pdf";
import { publish } from "@/common/sse";
import { resumeChannel } from "@/common/sse/channels/resume";
import {
  deleteAllResumeArtifacts,
  deleteResumeFile,
  ensureGeneratedDir,
  ensureResumeBackupsDir,
  ensureResumesDir,
  generateResumeFilename,
  generatedResumePath,
  generatedVariantPath,
  resumeBackupPath,
  resumePath,
  slugifyForDownload,
} from "@/common/storage";
import { PrismaClient } from "@/generated/prisma/client";
import { backfillResumeIds } from "./backfill-ids";
import type { VariantRewriteAudit } from "./rewrite";
import { validateRewrites } from "./rewrite";
import { tailorBase } from "./tailor";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

type ResumeVariantCreateInput = z.infer<typeof resumeVariantCreateSchema>;
type ResumeVariantPatch = z.infer<typeof resumeVariantPatchSchema>;

export interface TailorVariantBody {
  label: string;
  jobUrl?: string | null;
  applicationId?: number | null;
  summary?: string;
  emphasizedTech?: string[];
  jobKeywords?: string[];
  diffNotes?: string | null;
  maxBulletsPerEntry?: number;
  rewordTopN?: number;
  bulletRewrites?: { entryIndex: number; bullets: { original: string; tailored: string }[] }[];
}

interface TailoredVariantResult {
  id: number;
  pdfUrl: string;
  rewordedBullets: number;
  flags: string[];
}

@singleton()
export class ResumeService {
  constructor(private readonly prisma: PrismaClient) {}

  private findResume(profileId: number, id: number) {
    return findOwned(
      (where) => this.prisma.resume.findFirst({ where }),
      { id, profileId },
      "Resume",
    );
  }

  async list(profileId: number) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { primaryResumeId: true },
    });
    const primaryId = profile?.primaryResumeId ?? null;

    const resumes = await this.prisma.resume.findMany({
      where: { profileId },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { variants: true } } },
    });

    return resumes
      .map((r) => ({
        id: r.id,
        label: r.label,
        sourceFilename: r.sourceFilename,
        hasData: r.content !== null,
        variantCount: r._count.variants,
        isPrimary: r.id === primaryId,
        updatedAt: r.updatedAt.toISOString(),
      }))
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
  }

  /** Create a structured resume from a JSON body. */
  async createJson(
    profileId: number,
    input: { label: string; content?: ResumeData },
  ): Promise<{ id: number }> {
    const resume = await this.prisma.resume.create({
      data: {
        profileId,
        label: input.label,
        content: input.content ? JSON.stringify(input.content) : null,
      },
    });
    return { id: resume.id };
  }

  /** Create a resume from an uploaded source file (multipart). */
  async createFromUpload(
    profileId: number,
    file: File,
    labelRaw?: string,
  ): Promise<{ id: number }> {
    if (file.size > MAX_RESUME_BYTES) {
      throw badRequest("Resume must be 5 MB or less");
    }

    const label =
      labelRaw && labelRaw.trim()
        ? labelRaw.trim()
        : path.basename(file.name, path.extname(file.name)) || "Resume";

    const dir = await ensureResumesDir();
    const filename = generateResumeFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const resume = await this.prisma.resume.create({
      data: {
        profileId,
        label,
        sourceFilename: filename,
        sourceMimeType: file.type || "application/pdf",
        sourceSizeBytes: file.size,
      },
    });

    const isFirst = (await this.prisma.resume.count({ where: { profileId } })) === 1;
    if (isFirst) {
      await this.prisma.profile.update({
        where: { id: profileId },
        data: { primaryResumeId: resume.id },
      });
    }

    return { id: resume.id };
  }

  async get(profileId: number, id: number) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { primaryResumeId: true },
    });
    const resume = await this.findResume(profileId, id);

    let content: ResumeData | null = null;

    if (resume.content) {
      const parsed = JSON.parse(resume.content) as ResumeData;
      const { content: backfilled, mutated } = backfillResumeIds(parsed);
      content = backfilled;
      if (mutated) {
        await this.prisma.resume.update({
          where: { id: resume.id },
          data: { content: JSON.stringify(backfilled) },
        });
      }
    }

    return {
      id: resume.id,
      profileId: resume.profileId,
      label: resume.label,
      content,
      version: resume.version,
      sourceFilename: resume.sourceFilename,
      sourceMimeType: resume.sourceMimeType,
      sourceSizeBytes: resume.sourceSizeBytes,
      isPrimary: profile?.primaryResumeId === resume.id,
      createdAt: resume.createdAt.toISOString(),
      updatedAt: resume.updatedAt.toISOString(),
    };
  }

  async update(
    profileId: number,
    id: number,
    body: { label?: string; content?: ResumeData },
  ): Promise<{ id: number; version: number }> {
    if (body.label === undefined && body.content === undefined) {
      throw badRequest("label or content required");
    }

    const existing = await this.findResume(profileId, id);

    const updated = await this.prisma.resume.update({
      where: { id },
      data: {
        label: body.label ?? existing.label,
        content: body.content ? JSON.stringify(body.content) : existing.content,
        version: body.content ? existing.version + 1 : existing.version,
      },
    });

    if (body.content) {
      await ensureResumeBackupsDir();
      await writeFile(
        resumeBackupPath(updated.id, updated.updatedAt.getTime()),
        JSON.stringify(body.content, null, 2),
        "utf8",
      );
      publish(
        resumeChannel,
        { resumeId: updated.id },
        {
          type: "content.updated",
          resumeId: updated.id,
          version: updated.version,
        },
      );
    }

    return { id: updated.id, version: updated.version };
  }

  async remove(profileId: number, id: number): Promise<{ deleted: number }> {
    const existing = await findOwned(
      (where) =>
        this.prisma.resume.findFirst({
          where,
          select: {
            id: true,
            sourceFilename: true,
            variants: { select: { id: true } },
          },
        }),
      { id, profileId },
      "Resume",
    );

    await this.prisma.profile.updateMany({
      where: { id: profileId, primaryResumeId: id },
      data: { primaryResumeId: null },
    });

    await this.prisma.resume.delete({ where: { id } });
    await deleteAllResumeArtifacts({
      resumeId: existing.id,
      sourceFilename: existing.sourceFilename,
      variantIds: existing.variants.map((v) => v.id),
    });

    return { deleted: id };
  }

  // ── PDF rendering ────────────────────────────────────────────────────────

  private streamFile(filePath: string, mime: string, downloadName: string): Promise<Response> {
    return stat(filePath).then((stats) => {
      const stream = createReadStream(filePath);
      return new Response(stream as unknown as ReadableStream, {
        headers: {
          "content-type": mime,
          "content-length": String(stats.size),
          "content-disposition": `inline; filename="${downloadName}"`,
        },
      });
    });
  }

  async renderPdf(profileId: number, id: number): Promise<Response> {
    const resume = await this.findResume(profileId, id);
    const slug = slugifyForDownload(resume.label);

    if (resume.content) {
      await ensureGeneratedDir();
      const cachePath = generatedResumePath(resume.id, resume.updatedAt.getTime());
      try {
        await stat(cachePath);
      } catch {
        const buffer = await renderResumePdf(JSON.parse(resume.content) as ResumeData);
        await writeFile(cachePath, buffer);
      }
      return this.streamFile(cachePath, "application/pdf", `${slug}.pdf`);
    }

    if (resume.sourceFilename) {
      try {
        return await this.streamFile(
          resumePath(resume.sourceFilename),
          resume.sourceMimeType ?? "application/pdf",
          resume.sourceFilename,
        );
      } catch {
        throw notFound("Source file missing on disk");
      }
    }

    throw notFound("Resume has no data or source PDF");
  }

  async renderVariantPdf(profileId: number, variantId: number): Promise<Response> {
    const variant = await findOwned(
      (where) => this.prisma.resumeVariant.findFirst({ where }),
      { id: variantId, resume: { profileId } },
      "Variant",
    );

    await ensureGeneratedDir();
    const cachePath = generatedVariantPath(variant.id, variant.updatedAt.getTime());
    try {
      await stat(cachePath);
    } catch {
      const buffer = await renderResumePdf(JSON.parse(variant.content) as ResumeData);
      await writeFile(cachePath, buffer);
    }

    return this.streamFile(
      cachePath,
      "application/pdf",
      `${slugifyForDownload(variant.label)}.pdf`,
    );
  }

  // ── Source file (upload / stream / delete) ────────────────────────────────

  async getSource(profileId: number, id: number): Promise<Response> {
    const resume = await this.findResume(profileId, id);
    if (!resume.sourceFilename) {
      throw notFound("No source PDF uploaded");
    }

    const filePath = resumePath(resume.sourceFilename);
    try {
      const stats = await stat(filePath);
      const stream = createReadStream(filePath);
      return new Response(stream as unknown as ReadableStream, {
        headers: {
          "content-type": resume.sourceMimeType ?? "application/pdf",
          "content-length": String(stats.size),
          "content-disposition": `inline; filename="${resume.sourceFilename}"`,
        },
      });
    } catch {
      throw notFound("Source file missing on disk");
    }
  }

  async uploadSource(
    profileId: number,
    id: number,
    file: File,
  ): Promise<{ id: number; sourceFilename: string }> {
    const resume = await this.findResume(profileId, id);

    if (file.size > MAX_RESUME_BYTES) {
      throw badRequest("Resume must be 5 MB or less");
    }

    const dir = await ensureResumesDir();
    const filename = generateResumeFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    if (resume.sourceFilename) {
      await deleteResumeFile(resume.sourceFilename);
    }

    await this.prisma.resume.update({
      where: { id },
      data: {
        sourceFilename: filename,
        sourceMimeType: file.type || "application/pdf",
        sourceSizeBytes: file.size,
      },
    });

    return { id, sourceFilename: filename };
  }

  async deleteSource(profileId: number, id: number): Promise<{ id: number }> {
    const resume = await this.findResume(profileId, id);

    if (resume.sourceFilename) {
      await deleteResumeFile(resume.sourceFilename);
    }

    await this.prisma.resume.update({
      where: { id },
      data: { sourceFilename: null, sourceMimeType: null, sourceSizeBytes: null },
    });

    return { id };
  }

  // ── Variants ──────────────────────────────────────────────────────────────

  async listVariants(profileId: number, resumeId: number) {
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
    profileId: number,
    resumeId: number,
    body: ResumeVariantCreateInput,
  ): Promise<{ id: number }> {
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

  private findVariant(profileId: number, id: number) {
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

  async getVariant(profileId: number, id: number) {
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
      rewrites: variant.rewrites
        ? (JSON.parse(variant.rewrites) as VariantRewriteAudit)
        : null,
      createdAt: variant.createdAt.toISOString(),
      updatedAt: variant.updatedAt.toISOString(),
    };
  }

  async updateVariant(
    profileId: number,
    id: number,
    body: ResumeVariantPatch,
  ): Promise<{ id: number }> {
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

  async removeVariant(profileId: number, id: number): Promise<{ deleted: number }> {
    await this.findVariant(profileId, id);
    await this.prisma.resumeVariant.delete({ where: { id } });
    return { deleted: id };
  }

  // ── Tailoring ───────────────────────────────────────────────────────────--

  /**
   * Create a tailored resume variant from model-authored hints. The model
   * never writes structured ResumeData — just a tailored `summary` and a
   * small `emphasizedTech`/`jobKeywords` array. The server applies a
   * deterministic ranking against the base content.
   */
  async createTailoredVariant(
    profileId: number,
    resumeId: number,
    body: TailorVariantBody,
  ): Promise<TailoredVariantResult> {
    const base = await this.findResume(profileId, resumeId);

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

  /** Ownership assertion for the SSE events subscription. */
  async assertResumeOwned(profileId: number, id: number): Promise<void> {
    await findOwned(
      (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Resume",
    );
  }
}
