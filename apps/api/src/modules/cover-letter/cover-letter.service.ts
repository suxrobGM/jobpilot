import type { CoverLetterCreate } from "@jobpilot/contracts/cover-letter";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { renderCoverLetterPdf } from "@/common/pdf";
import { slugifyForDownload } from "@/common/storage";
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

  /** The active profile's cover letters, newest first (no body — list payload). */
  list(profileId: number) {
    return this.prisma.coverLetter.findMany({
      where: { profileId },
      orderBy: { createdAt: "desc" },
      select: LIST_SELECT,
    });
  }

  create(profileId: number, data: CoverLetterCreate) {
    return this.prisma.coverLetter.create({
      data: {
        profileId,
        content: data.content,
        jobUrl: data.jobUrl ?? null,
        jobTitle: data.jobTitle ?? null,
        company: data.company ?? null,
        source: data.source,
      },
    });
  }

  get(profileId: number, id: number) {
    return findOwned(
      (where) => this.prisma.coverLetter.findFirst({ where }),
      { id, profileId },
      "Cover letter",
    );
  }

  async remove(profileId: number, id: number): Promise<{ ok: true }> {
    await this.get(profileId, id);
    await this.prisma.coverLetter.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Render the `cover-letter` skill's plain text to a PDF for upload-only
   * application forms. Ephemeral — the text differs per job, so nothing is stored.
   */
  async renderEphemeralPdf(text: string, name?: string): Promise<CoverLetterPdf> {
    const buffer = await renderCoverLetterPdf(text);
    const slug = (name ?? "cover-letter").replace(/[^\w.-]+/g, "-");
    return { buffer, slug };
  }

  /** Render a saved cover letter to a PDF, viewable inline in a new tab. */
  async renderSavedPdf(profileId: number, id: number): Promise<CoverLetterPdf> {
    const letter = await this.get(profileId, id);
    const buffer = await renderCoverLetterPdf(letter.content);
    const slug = slugifyForDownload(
      letter.company ?? letter.jobTitle ?? `cover-letter-${letter.id}`,
    );
    return { buffer, slug };
  }
}
