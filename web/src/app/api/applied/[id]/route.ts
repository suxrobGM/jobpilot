import { err, ErrorCodes, ok } from "@/lib/api";
import { db } from "@/lib/db";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const appId = Number(id);

  if (!Number.isInteger(appId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const application = await db.application.findUnique({
    where: { id: appId },
    include: {
      stageEvents: { orderBy: { occurredAt: "asc" } },
    },
  });
  if (!application) {
    return err(ErrorCodes.NOT_FOUND, "Application not found", 404);
  }
  return ok(application);
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  try {
    await db.application.delete({ where: { id: appId } });
    return ok({ deleted: appId });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Application not found", 404);
    }
    throw e;
  }
}
