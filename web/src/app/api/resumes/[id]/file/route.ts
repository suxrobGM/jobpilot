import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { ErrorCodes, err } from "@/lib/api";
import { db } from "@/lib/db";
import { resumePath } from "@/lib/storage";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const resumeId = Number(id);
  if (!Number.isInteger(resumeId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  const resume = await db.resume.findUnique({ where: { id: resumeId } });
  if (!resume) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);

  const filePath = resumePath(resume.filename);
  try {
    const stats = await stat(filePath);
    const stream = createReadStream(filePath);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        "content-type": resume.mimeType,
        "content-length": String(stats.size),
        "content-disposition": `inline; filename="${resume.filename}"`,
      },
    });
  } catch {
    return err(ErrorCodes.NOT_FOUND, "Resume file missing on disk", 404);
  }
}
