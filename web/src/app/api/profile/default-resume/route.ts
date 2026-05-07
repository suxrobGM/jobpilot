import { z } from "zod/v4";
import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";

const SINGLETON_ID = 1;

const bodySchema = z.object({
  resumeId: z.number().int().nullable(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid body", 422, parsed.error.issues);
  }
  const profile = await db.profile.findUnique({ where: { id: SINGLETON_ID } });
  if (!profile) return err(ErrorCodes.NOT_FOUND, "Profile not found", 404);

  if (parsed.data.resumeId !== null) {
    const resume = await db.resume.findUnique({
      where: { id: parsed.data.resumeId },
    });
    if (!resume) return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);
  }

  await db.profile.update({
    where: { id: SINGLETON_ID },
    data: { defaultResumeId: parsed.data.resumeId },
  });
  return ok({ defaultResumeId: parsed.data.resumeId });
}
