import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { singleton } from "tsyringe";
import { badRequest, notFound } from "@/common/errors";
import { renderResumePdf } from "@/common/pdf";
import {
  deleteResumeFile,
  ensureGeneratedDir,
  ensureResumesDir,
  generatedResumePath,
  generateResumeFilename,
  resumePath,
  slugifyForDownload,
} from "@/common/storage";
import { PrismaClient } from "@/generated/prisma/client";
import { streamFile } from "../resume.stream";
import { findResume, MAX_RESUME_BYTES } from "../resume.utils";

@singleton()
export class ResumeFileService {
  constructor(private readonly prisma: PrismaClient) {}

  async renderPdf(profileId: number, id: number): Promise<Response> {
    const resume = await findResume(this.prisma, profileId, id);
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
      return streamFile(cachePath, "application/pdf", `${slug}.pdf`);
    }

    if (resume.sourceFilename) {
      try {
        return await streamFile(
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

  async getSource(profileId: number, id: number): Promise<Response> {
    const resume = await findResume(this.prisma, profileId, id);
    if (!resume.sourceFilename) {
      throw notFound("No source PDF uploaded");
    }

    try {
      return await streamFile(
        resumePath(resume.sourceFilename),
        resume.sourceMimeType ?? "application/pdf",
        resume.sourceFilename,
      );
    } catch {
      throw notFound("Source file missing on disk");
    }
  }

  async uploadSource(
    profileId: number,
    id: number,
    file: File,
  ): Promise<{ id: number; sourceFilename: string }> {
    const resume = await findResume(this.prisma, profileId, id);

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
    const resume = await findResume(this.prisma, profileId, id);

    if (resume.sourceFilename) {
      await deleteResumeFile(resume.sourceFilename);
    }

    await this.prisma.resume.update({
      where: { id },
      data: { sourceFilename: null, sourceMimeType: null, sourceSizeBytes: null },
    });

    return { id };
  }
}
