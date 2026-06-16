import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResumeData } from "@jobpilot/contracts/resume";
import { singleton } from "tsyringe";
import { badRequest, notFound } from "@/common/errors";
import { renderResumePdf } from "@/common/pdf";
import {
  deleteResumeFile,
  ensureCachedPdf,
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

  async renderPdf(profileId: string, id: string): Promise<Response> {
    const resume = await findResume(this.prisma, profileId, id);
    const slug = slugifyForDownload(resume.label);

    if (resume.content) {
      const content = resume.content;
      await ensureGeneratedDir();
      const cachePath = generatedResumePath(resume.id, resume.updatedAt.getTime());
      await ensureCachedPdf(cachePath, () => renderResumePdf(JSON.parse(content) as ResumeData));
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

  async getSource(profileId: string, id: string): Promise<Response> {
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
    profileId: string,
    id: string,
    file: File,
  ): Promise<{ id: string; sourceFilename: string }> {
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

  async deleteSource(profileId: string, id: string): Promise<{ id: string }> {
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
