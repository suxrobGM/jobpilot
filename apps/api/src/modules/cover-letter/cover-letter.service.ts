import type { CoverLetterCreate, CoverLetterSource } from "@jobpilot/contracts/cover-letter";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { renderCoverLetterPdf } from "@/common/pdf/render";
import { slugifyForDownload } from "@/common/storage/storage";
import { PrismaClient } from "@/generated/prisma/client";

const LIST_SELECT = {
  id: true,
  jobTitle: true,
  company: true,
  jobUrl: true,
  source: true,
  createdAt: true,
} as const;

/** A rendered PDF plus the slug to use for its inline filename. */
export interface CoverLetterPdf {
  buffer: Buffer;
  slug: string;
}

@singleton()
export class CoverLetterService {
  constructor(private readonly prisma: PrismaClient) {}

  /** One page of the active profile's cover letters, newest first (no body - list payload). */
  async list(userId: string, query: PaginationQuery) {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.coverLetter.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...pageSlice(query),
        select: LIST_SELECT,
      }),
      this.prisma.coverLetter.count({ where }),
    ]);
    return paginate(
      rows.map((row) => ({ ...row, source: row.source as CoverLetterSource })),
      query,
      total,
    );
  }

  create(userId: string, data: CoverLetterCreate) {
    return this.prisma.coverLetter.create({
      data: {
        userId,
        content: data.content,
        jobUrl: data.jobUrl ?? null,
        jobTitle: data.jobTitle ?? null,
        company: data.company ?? null,
        source: data.source,
      },
    });
  }

  async get(userId: string, id: string) {
    const row = await findOwned(
      (where) => this.prisma.coverLetter.findFirst({ where }),
      { id, userId },
      "Cover letter",
    );
    return {
      ...row,
      source: row.source as CoverLetterSource,
      createdAt: row.createdAt,
    };
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    await this.get(userId, id);
    await this.prisma.coverLetter.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Render the `cover-letter` skill's plain text to a PDF for upload-only
   * application forms. Ephemeral - the text differs per job, so nothing is stored.
   */
  async renderEphemeralPdf(text: string, name?: string): Promise<CoverLetterPdf> {
    const buffer = await renderCoverLetterPdf(text);
    const slug = (name ?? "cover-letter").replace(/[^\w.-]+/g, "-");
    return { buffer, slug };
  }

  /** Render a saved cover letter to a PDF, viewable inline in a new tab. */
  async renderSavedPdf(userId: string, id: string): Promise<CoverLetterPdf> {
    const letter = await this.get(userId, id);
    const buffer = await renderCoverLetterPdf(letter.content);
    const slug = slugifyForDownload(
      letter.company ?? letter.jobTitle ?? `cover-letter-${letter.id}`,
    );
    return { buffer, slug };
  }
}
