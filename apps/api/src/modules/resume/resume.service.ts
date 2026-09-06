import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { resumeChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { badRequest, findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import {
  deleteAllResumeArtifacts,
  ensureResumesDir,
  generateResumeFilename,
} from "@/common/storage/storage";
import { PrismaClient } from "@/generated/prisma/client";
import { backfillResumeIds } from "./backfill-ids";
import { findProfileMismatches } from "./consistency";
import { findResume, MAX_RESUME_BYTES } from "./resume.utils";

@singleton()
export class ResumeService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Unpaginated: an account holds a handful of master resumes, and selects read the whole list. */
  async list(userId: string) {
    const [profile, resumes] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { primaryResumeId: true } }),
      this.prisma.resume.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        include: { _count: { select: { variants: true } } },
      }),
    ]);
    const primaryId = profile?.primaryResumeId ?? null;

    return resumes
      .map((r) => ({
        id: r.id,
        label: r.label,
        sourceFilename: r.sourceFilename,
        hasData: r.content !== null,
        variantCount: r._count.variants,
        isPrimary: r.id === primaryId,
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
  }

  /** Create a structured resume from a JSON body. */
  async createJson(
    userId: string,
    input: { label: string; content?: ResumeData },
  ): Promise<{ id: string }> {
    const resume = await this.prisma.resume.create({
      data: {
        userId,
        label: input.label,
        content: input.content ? JSON.stringify(input.content) : null,
      },
    });
    return { id: resume.id };
  }

  /** Create a resume from an uploaded source file (multipart). */
  async createFromUpload(userId: string, file: File, labelRaw?: string): Promise<{ id: string }> {
    if (file.size > MAX_RESUME_BYTES) {
      throw badRequest("Resume must be 5 MB or less");
    }

    const label = labelRaw?.trim()
      ? labelRaw.trim()
      : path.basename(file.name, path.extname(file.name)) || "Resume";

    const dir = await ensureResumesDir();
    const filename = generateResumeFilename(file.name);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, filename), buffer);

    const resume = await this.prisma.resume.create({
      data: {
        userId,
        label,
        sourceFilename: filename,
        sourceMimeType: file.type || "application/pdf",
        sourceSizeBytes: file.size,
      },
    });

    const isFirst = (await this.prisma.resume.count({ where: { userId } })) === 1;
    if (isFirst) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { primaryResumeId: resume.id },
      });
    }

    return { id: resume.id };
  }

  async get(userId: string, id: string) {
    const [profile, resume] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          primaryResumeId: true,
          city: true,
          state: true,
          contactEmail: true,
          phone: true,
          linkedin: true,
          github: true,
          website: true,
        },
      }),
      findResume(this.prisma, userId, id),
    ]);

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
      userId: resume.userId,
      label: resume.label,
      content,
      version: resume.version,
      sourceFilename: resume.sourceFilename,
      sourceMimeType: resume.sourceMimeType,
      sourceSizeBytes: resume.sourceSizeBytes,
      isPrimary: profile?.primaryResumeId === resume.id,
      // Served here rather than behind its own route: every reader of the contact block needs it.
      profileMismatches: profile ? findProfileMismatches(content?.basics, profile) : [],
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }

  async update(
    userId: string,
    id: string,
    body: { label?: string; content?: ResumeData },
  ): Promise<{ id: string; version: number }> {
    if (body.label === undefined && body.content === undefined) {
      throw badRequest("label or content required");
    }

    const existing = await findResume(this.prisma, userId, id);

    const updated = await this.prisma.resume.update({
      where: { id },
      data: {
        label: body.label ?? existing.label,
        content: body.content ? JSON.stringify(body.content) : existing.content,
        version: body.content ? existing.version + 1 : existing.version,
      },
    });

    if (body.content) {
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

  async remove(userId: string, id: string): Promise<{ deleted: string }> {
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
      { id, userId },
      "Resume",
    );

    await this.prisma.user.updateMany({
      where: { id: userId, primaryResumeId: id },
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

  /** Ownership assertion for the SSE events subscription. */
  async assertResumeOwned(userId: string, id: string): Promise<void> {
    await findOwned(
      (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Resume",
    );
  }
}
