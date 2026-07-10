import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { singleton } from "tsyringe";
import { badRequest, findOwned } from "@/common/errors";
import { publish } from "@/common/sse";
import { resumeChannel } from "@/common/sse/channels/resume";
import {
  deleteAllResumeArtifacts,
  ensureResumesDir,
  generateResumeFilename,
} from "@/common/storage";
import { PrismaClient } from "@/generated/prisma/client";
import { backfillResumeIds } from "./backfill-ids";
import { findResume, MAX_RESUME_BYTES } from "./resume.utils";

@singleton()
export class ResumeService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(profileId: string) {
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
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));
  }

  /** Create a structured resume from a JSON body. */
  async createJson(
    profileId: string,
    input: { label: string; content?: ResumeData },
  ): Promise<{ id: string }> {
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
    profileId: string,
    file: File,
    labelRaw?: string,
  ): Promise<{ id: string }> {
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

  async get(profileId: string, id: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: profileId },
      select: { primaryResumeId: true },
    });
    const resume = await findResume(this.prisma, profileId, id);

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
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }

  async update(
    profileId: string,
    id: string,
    body: { label?: string; content?: ResumeData },
  ): Promise<{ id: string; version: number }> {
    if (body.label === undefined && body.content === undefined) {
      throw badRequest("label or content required");
    }

    const existing = await findResume(this.prisma, profileId, id);

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

  async remove(profileId: string, id: string): Promise<{ deleted: string }> {
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

  /** Ownership assertion for the SSE events subscription. */
  async assertResumeOwned(profileId: string, id: string): Promise<void> {
    await findOwned(
      (where) => this.prisma.resume.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Resume",
    );
  }
}
