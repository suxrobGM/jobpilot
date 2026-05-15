import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { patchQueueSchema } from "@/lib/schemas/queue";

type Params = ApiRouteContext<{ id: string }>;

export async function PATCH(req: Request, ctx: Params) {
  const { id } = await parsePathParams(ctx);
  const entryId = Number(id);

  if (!Number.isInteger(entryId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const body = await req.json();
  const parsed = patchQueueSchema.safeParse(body);

  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid patch", 422, parsed.error.issues);
  }

  try {
    const item = await db.queueEntry.update({
      where: { id: entryId },
      data: {
        status: parsed.data.status,
        consumedAt: parsed.data.status === "consumed" ? new Date() : null,
      },
    });
    return ok(item);
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Queue entry not found", 404);
    }
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await parsePathParams(ctx);
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  try {
    await db.queueEntry.delete({ where: { id: entryId } });
    return ok({ deleted: entryId });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Queue entry not found", 404);
    }
    throw e;
  }
}
