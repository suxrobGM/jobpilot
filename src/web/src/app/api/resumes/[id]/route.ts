import { writeFile } from "node:fs/promises";
import { z } from "zod/v4";
import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { resumeDataSchema } from "@/lib/schemas/resume";
import {
  deleteResumeFile,
  ensureResumeBackupsDir,
  resumeBackupPath,
} from "@/lib/storage";
import type { ResumeDto } from "@/types/api";

const PROFILE_ID = 1;

type Params = ApiRouteContext<{ id: string }>;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);

  const profile = await db.profile.findUnique({
    where: { id: PROFILE_ID },
    select: { primaryResumeId: true },
  });
  const resume = await db.resume.findFirst({
    where: { id, profileId: PROFILE_ID },
  });
  if (!resume) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);

  const dto: ResumeDto = {
    id: resume.id,
    profileId: resume.profileId,
    label: resume.label,
    data: resume.data ? JSON.parse(resume.data) : null,
    version: resume.version,
    sourceFilename: resume.sourceFilename,
    sourceMimeType: resume.sourceMimeType,
    sourceSizeBytes: resume.sourceSizeBytes,
    isPrimary: profile?.primaryResumeId === resume.id,
    createdAt: resume.createdAt.toISOString(),
    updatedAt: resume.updatedAt.toISOString(),
  };
  return ok(dto);
}

const putSchema = z.object({
  label: z.string().min(1).optional(),
  data: resumeDataSchema.optional(),
});

export async function PUT(req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);

  const body = await req.json();
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid body", 422, parsed.error.issues);
  }
  if (parsed.data.label === undefined && parsed.data.data === undefined) {
    return err(ErrorCodes.INVALID_REQUEST, "label or data required", 400);
  }

  const existing = await db.resume.findFirst({
    where: { id, profileId: PROFILE_ID },
  });
  if (!existing) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);

  const updated = await db.resume.update({
    where: { id },
    data: {
      label: parsed.data.label ?? existing.label,
      data: parsed.data.data ? JSON.stringify(parsed.data.data) : existing.data,
      version: parsed.data.data ? existing.version + 1 : existing.version,
    },
  });

  if (parsed.data.data) {
    await ensureResumeBackupsDir();
    await writeFile(
      resumeBackupPath(updated.id, updated.updatedAt.getTime()),
      JSON.stringify(parsed.data.data, null, 2),
      "utf8",
    );
  }

  return ok({ id: updated.id, version: updated.version });
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);

  const existing = await db.resume.findFirst({
    where: { id, profileId: PROFILE_ID },
  });
  if (!existing) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);

  await db.profile.updateMany({
    where: { id: PROFILE_ID, primaryResumeId: id },
    data: { primaryResumeId: null },
  });

  await db.resume.delete({ where: { id } });
  if (existing.sourceFilename) {
    await deleteResumeFile(existing.sourceFilename);
  }

  return ok({ deleted: id });
}
