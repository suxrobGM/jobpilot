import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { resumeVariantCreateSchema } from "@/lib/schemas/resume";
import type { ResumeVariantListItem } from "@/types/api";

const PROFILE_ID = 1;

type Params = ApiRouteContext<{ id: string }>;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const resumeId = parseId(rawId);
  if (resumeId === null) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const resume = await db.resume.findFirst({
    where: { id: resumeId, profileId: PROFILE_ID },
    select: { id: true },
  });
  if (!resume) {
    return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);
  }

  const variants = await db.resumeVariant.findMany({
    where: { resumeId },
    orderBy: { updatedAt: "desc" },
  });

  const items: ResumeVariantListItem[] = variants.map((v) => ({
    id: v.id,
    resumeId: v.resumeId,
    label: v.label,
    jobUrl: v.jobUrl,
    applicationId: v.applicationId,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));
  return ok(items);
}

export async function POST(req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const resumeId = parseId(rawId);
  if (resumeId === null) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const resume = await db.resume.findFirst({
    where: { id: resumeId, profileId: PROFILE_ID },
    select: { id: true },
  });
  if (!resume) {
    return err(ErrorCodes.NOT_FOUND, "Resume not found", 404);
  }

  const body = await req.json();
  const parsed = resumeVariantCreateSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid body", 422, parsed.error.issues);
  }

  if (parsed.data.applicationId) {
    const app = await db.application.findUnique({
      where: { id: parsed.data.applicationId },
      select: { id: true },
    });
    if (!app) return err(ErrorCodes.NOT_FOUND, "Application not found", 404);
  }

  const variant = await db.resumeVariant.create({
    data: {
      resumeId,
      label: parsed.data.label,
      jobUrl: parsed.data.jobUrl ?? null,
      applicationId: parsed.data.applicationId ?? null,
      data: JSON.stringify(parsed.data.data),
      diffNotes: parsed.data.diffNotes ?? null,
    },
  });

  return ok({ id: variant.id }, { status: 201 });
}
