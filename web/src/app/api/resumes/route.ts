import { writeFile } from "node:fs/promises";
import path from "node:path";
import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { ensureResumesDir, generateResumeFilename } from "@/lib/storage";

const PROFILE_ID = 1;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export async function GET() {
  const resumes = await db.resume.findMany({
    where: { profileId: PROFILE_ID },
    orderBy: { createdAt: "desc" },
  });
  return ok(resumes);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const labelRaw = form.get("label");

  if (!(file instanceof File)) {
    return err(ErrorCodes.INVALID_REQUEST, "file field is required", 400);
  }
  if (typeof labelRaw !== "string" || !labelRaw.trim()) {
    return err(ErrorCodes.INVALID_REQUEST, "label field is required", 400);
  }
  if (file.size > MAX_RESUME_BYTES) {
    return err(ErrorCodes.INVALID_REQUEST, "Resume must be 5 MB or less", 400);
  }

  const profileExists = await db.profile.findUnique({ where: { id: PROFILE_ID } });
  if (!profileExists) {
    return err(
      ErrorCodes.UNPROCESSABLE,
      "Profile not initialized; complete onboarding first",
      422,
    );
  }

  const dir = await ensureResumesDir();
  const filename = generateResumeFilename(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  const resume = await db.resume.create({
    data: {
      label: labelRaw.trim(),
      filename,
      mimeType: file.type || "application/pdf",
      sizeBytes: file.size,
      profileId: PROFILE_ID,
    },
  });

  return ok(resume, { status: 201 });
}
