import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { deleteResumeFile } from "@/lib/storage";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const resumeId = Number(id);
  if (!Number.isInteger(resumeId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  const existing = await db.resume.findUnique({ where: { id: resumeId } });
  if (!existing) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);

  // Clear default reference if this resume is the default
  await db.profile.updateMany({
    where: { defaultResumeId: resumeId },
    data: { defaultResumeId: null },
  });

  await db.resume.delete({ where: { id: resumeId } });
  await deleteResumeFile(existing.filename);

  return ok({ deleted: resumeId });
}
