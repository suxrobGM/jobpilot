import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { resumeVariantPatchSchema } from "@/lib/schemas/resume";
import type { ResumeVariantDto } from "@/types/api";

const PROFILE_ID = 1;

type Params = ApiRouteContext<{ id: string }>;

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadOwned(id: number) {
  return db.resumeVariant.findFirst({
    where: { id, resume: { profileId: PROFILE_ID } },
    include: { resume: { select: { label: true } } },
  });
}

export async function GET(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const variant = await loadOwned(id);
  if (!variant) {
    return err(ErrorCodes.NOT_FOUND, "Variant not found", 404);
  }

  const dto: ResumeVariantDto = {
    id: variant.id,
    resumeId: variant.resumeId,
    resumeLabel: variant.resume.label,
    label: variant.label,
    jobUrl: variant.jobUrl,
    applicationId: variant.applicationId,
    data: JSON.parse(variant.data),
    diffNotes: variant.diffNotes,
    createdAt: variant.createdAt.toISOString(),
    updatedAt: variant.updatedAt.toISOString(),
  };
  return ok(dto);
}

export async function PATCH(req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const variant = await loadOwned(id);
  if (!variant) {
    return err(ErrorCodes.NOT_FOUND, "Variant not found", 404);
  }

  const body = await req.json();
  const parsed = resumeVariantPatchSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid body", 422, parsed.error.issues);
  }

  const updated = await db.resumeVariant.update({
    where: { id },
    data: {
      label: parsed.data.label ?? undefined,
      jobUrl: parsed.data.jobUrl === undefined ? undefined : parsed.data.jobUrl,
      applicationId:
        parsed.data.applicationId === undefined ? undefined : parsed.data.applicationId,
      data: parsed.data.data ? JSON.stringify(parsed.data.data) : undefined,
      diffNotes: parsed.data.diffNotes === undefined ? undefined : parsed.data.diffNotes,
    },
  });
  return ok({ id: updated.id });
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id: rawId } = await parsePathParams(ctx);
  const id = parseId(rawId);
  if (id === null) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const variant = await loadOwned(id);
  if (!variant) {
    return err(ErrorCodes.NOT_FOUND, "Variant not found", 404);
  }

  await db.resumeVariant.delete({ where: { id } });
  return ok({ deleted: id });
}
