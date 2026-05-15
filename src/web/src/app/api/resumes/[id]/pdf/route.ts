import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import { err, ErrorCodes } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { renderResumePdf } from "@/lib/pdf/render";
import type { ResumeData } from "@/lib/schemas/resume";
import {
  ensureGeneratedDir,
  generatedResumePath,
  resumePath,
  slugifyForDownload,
} from "@/lib/storage";

const PROFILE_ID = 1;

type Params = ApiRouteContext<{ id: string }>;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function streamFile(filePath: string, mime: string, downloadName: string): Promise<Response> {
  const stats = await stat(filePath);
  const stream = createReadStream(filePath);
  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": mime,
      "content-length": String(stats.size),
      "content-disposition": `inline; filename="${downloadName}"`,
    },
  });
}

export async function GET(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);

  const resume = await db.resume.findFirst({
    where: { id, profileId: PROFILE_ID },
  });
  if (!resume) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);

  const slug = slugifyForDownload(resume.label);

  if (resume.data) {
    await ensureGeneratedDir();
    const cachePath = generatedResumePath(resume.id, resume.updatedAt.getTime());
    try {
      await stat(cachePath);
    } catch {
      const buffer = await renderResumePdf(JSON.parse(resume.data) as ResumeData);
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
      return err(ErrorCodes.NOT_FOUND, "Source file missing on disk", 404);
    }
  }

  return err(ErrorCodes.NOT_FOUND, "Resume has no data or source PDF", 404);
}
