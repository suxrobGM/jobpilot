import path from "node:path";
import { inject, injectable } from "@needle-di/core";
import type { z } from "zod/v4";
import { badRequest, findOwned, notFound } from "@/common/errors";
import { renderResumePdf } from "@/common/pdf/render";
import { ResumeStorage, streamFile } from "@/common/storage/resume.storage";
import { PrismaClient, type Resume } from "@/generated/prisma/client";
import { findProfileMismatches } from "./consistency";
import { readContent, toStoredContent } from "./content";
import { publishResumeEvent } from "./resume.events";
import type { createResumeSchema, updateResumeSchema } from "./resume.schema";

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

type CreateResumeInput = z.infer<typeof createResumeSchema>;
type UpdateResumeInput = z.infer<typeof updateResumeSchema>;

interface SavedSource {
  sourceFilename: string;
  sourceMimeType: string;
  sourceSizeBytes: number;
}

@injectable()
export class ResumeService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly storage = inject(ResumeStorage),
  ) {}

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

    return resumes
      .map((r) => ({
        id: r.id,
        label: r.label,
        sourceFilename: r.sourceFilename,
        hasData: r.content !== null,
        variantCount: r._count.variants,
        isPrimary: r.id === profile?.primaryResumeId,
        updatedAt: r.updatedAt,
      }))
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  }

  async createJson(userId: string, input: CreateResumeInput) {
    const resume = await this.prisma.resume.create({
      data: {
        userId,
        label: input.label,
        content: input.content && toStoredContent(input.content),
      },
    });
    await this.claimPrimaryIfUnset(userId, resume.id);
    return { id: resume.id };
  }

  async createFromUpload(userId: string, file: File, label?: string) {
    const resume = await this.withSavedSource(file, (source) =>
      this.prisma.resume.create({
        data: {
          userId,
          label: label?.trim() || path.basename(file.name, path.extname(file.name)) || "Resume",
          ...source,
        },
      }),
    );
    await this.claimPrimaryIfUnset(userId, resume.id);
    return { id: resume.id };
  }

  async get(userId: string, id: string) {
    const [user, resume] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          primaryResumeId: true,
          profile: {
            select: {
              city: true,
              state: true,
              contactEmail: true,
              phone: true,
              linkedin: true,
              github: true,
              website: true,
            },
          },
        },
      }),
      this.findOwned(userId, id),
    ]);
    const content = resume.content === null ? null : readContent(resume.content);

    return {
      id: resume.id,
      userId: resume.userId,
      label: resume.label,
      content,
      version: resume.version,
      sourceFilename: resume.sourceFilename,
      sourceMimeType: resume.sourceMimeType,
      sourceSizeBytes: resume.sourceSizeBytes,
      isPrimary: user?.primaryResumeId === resume.id,
      // Served here rather than behind its own route: every reader of the contact block needs it.
      profileMismatches: user?.profile ? findProfileMismatches(content?.basics, user.profile) : [],
      createdAt: resume.createdAt,
      updatedAt: resume.updatedAt,
    };
  }

  async update(userId: string, id: string, body: UpdateResumeInput) {
    if (body.label === undefined && body.content === undefined) {
      throw badRequest("label or content required");
    }
    await this.findOwned(userId, id);

    const updated = await this.prisma.resume.update({
      where: { id },
      data: {
        label: body.label,
        ...(body.content && {
          content: toStoredContent(body.content),
          version: { increment: 1 },
        }),
      },
    });

    if (body.content) {
      publishResumeEvent(userId, {
        type: "content.updated",
        resumeId: id,
        version: updated.version,
      });
    }
    return { id, version: updated.version };
  }

  async remove(userId: string, id: string) {
    const resume = await findOwned(
      (where) =>
        this.prisma.resume.findFirst({
          where,
          select: { sourceFilename: true, variants: { select: { id: true } } },
        }),
      { id, userId },
      "Resume",
    );

    // `User.primaryResume` is `onDelete: SetNull`, so the pointer clears with the row.
    await this.prisma.resume.delete({ where: { id } });
    await this.storage.deleteAllResumeArtifacts([
      {
        resumeId: id,
        sourceFilename: resume.sourceFilename,
        variantIds: resume.variants.map((v) => v.id),
      },
    ]);

    return { deleted: id };
  }

  findOwned(userId: string, id: string): Promise<Resume> {
    return findOwned((where) => this.prisma.resume.findFirst({ where }), { id, userId }, "Resume");
  }

  async renderPdf(userId: string, id: string) {
    return this.streamPdf(await this.findOwned(userId, id));
  }

  /** Unauthenticated: the resume's v4 uuid is the capability token. */
  async renderPublicPdf(id: string) {
    const resume = await this.prisma.resume.findUnique({ where: { id } });
    if (!resume) {
      throw notFound("Resume not found");
    }
    return this.streamPdf(resume);
  }

  /** Rendered from structured content when there is some, else the uploaded source. */
  private async streamPdf(resume: Resume): Promise<Response> {
    const { content } = resume;
    if (content !== null) {
      return this.storage.serveCachedPdf(
        this.storage.generatedResumePath(resume.id, resume.updatedAt.getTime()),
        () => renderResumePdf(readContent(content)),
        resume.label,
      );
    }
    return this.streamSource(resume);
  }

  async getSource(userId: string, id: string) {
    return this.streamSource(await this.findOwned(userId, id));
  }

  private async streamSource(resume: Resume): Promise<Response> {
    if (!resume.sourceFilename) {
      throw notFound("Resume has no source file");
    }
    try {
      return await streamFile(
        this.storage.resumePath(resume.sourceFilename),
        resume.sourceMimeType ?? "application/pdf",
        resume.sourceFilename,
      );
    } catch {
      throw notFound("Source file missing on disk");
    }
  }

  async uploadSource(userId: string, id: string, file: File) {
    const resume = await this.findOwned(userId, id);
    const source = await this.withSavedSource(file, async (source) => {
      await this.prisma.resume.update({ where: { id }, data: source });
      return source;
    });
    // Only once the row points at the new file, so a failed write never leaves it dangling.
    if (resume.sourceFilename) {
      await this.storage.deleteResumeFile(resume.sourceFilename);
    }
    return { id, sourceFilename: source.sourceFilename };
  }

  async deleteSource(userId: string, id: string) {
    const resume = await this.findOwned(userId, id);
    await this.prisma.resume.update({
      where: { id },
      data: { sourceFilename: null, sourceMimeType: null, sourceSizeBytes: null },
    });
    if (resume.sourceFilename) {
      await this.storage.deleteResumeFile(resume.sourceFilename);
    }
    return { id };
  }

  /** Saves the upload, then runs the row write; a failed write removes the file it would have orphaned. */
  private async withSavedSource<T>(
    file: File,
    write: (source: SavedSource) => Promise<T>,
  ): Promise<T> {
    if (file.size > MAX_RESUME_BYTES) {
      throw badRequest("Resume must be 5 MB or less");
    }
    const sourceFilename = await this.storage.saveResumeSource(file);
    try {
      return await write({
        sourceFilename,
        sourceMimeType: file.type || "application/pdf",
        sourceSizeBytes: file.size,
      });
    } catch (error) {
      await this.storage.deleteResumeFile(sourceFilename);
      throw error;
    }
  }

  /** Conditional write rather than count-then-set, so two first uploads cannot both claim it. */
  private async claimPrimaryIfUnset(userId: string, resumeId: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, primaryResumeId: null },
      data: { primaryResumeId: resumeId },
    });
  }
}
