import { createReadStream } from "node:fs";
import { stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import {
  deleteResumeFile,
  ensureResumesDir,
  generateResumeFilename,
  resumePath,
} from "@/lib/storage";

const PROFILE_ID = 1;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

type Params = ApiRouteContext<{ id: string }>;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);

  const resume = await db.resume.findFirst({
    where: { id, profileId: PROFILE_ID },
  });
  if (!resume) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);
  if (!resume.sourceFilename) {
    return err(ErrorCodes.NOT_FOUND, "No source PDF uploaded", 404);
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
    return err(ErrorCodes.NOT_FOUND, "Source file missing on disk", 404);
  }
}

export async function POST(req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const resume = await db.resume.findFirst({
    where: { id, profileId: PROFILE_ID },
  });
  if (!resume) {
    return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return err(ErrorCodes.INVALID_REQUEST, "file field is required", 400);
  }
  if (file.size > MAX_RESUME_BYTES) {
    return err(ErrorCodes.INVALID_REQUEST, "Resume must be 5 MB or less", 400);
  }

  const dir = await ensureResumesDir();
  const filename = generateResumeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  if (resume.sourceFilename) {
    await deleteResumeFile(resume.sourceFilename);
  }

  await db.resume.update({
    where: { id },
    data: {
      sourceFilename: filename,
      sourceMimeType: file.type || "application/pdf",
      sourceSizeBytes: file.size,
    },
  });

  return ok({ id, sourceFilename: filename });
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);

  const resume = await db.resume.findFirst({
    where: { id, profileId: PROFILE_ID },
  });
  if (!resume) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);

  if (resume.sourceFilename) {
    await deleteResumeFile(resume.sourceFilename);
  }

  await db.resume.update({
    where: { id },
    data: { sourceFilename: null, sourceMimeType: null, sourceSizeBytes: null },
  });

  return ok({ id });
}
