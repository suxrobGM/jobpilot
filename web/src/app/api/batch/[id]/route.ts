import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { patchBatchSchema } from "@/lib/schemas/batch";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const batchId = Number(id);
  if (!Number.isInteger(batchId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  const body = await req.json();
  const parsed = patchBatchSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid patch", 422, parsed.error.issues);
  }
  try {
    const item = await db.batchInput.update({
      where: { id: batchId },
      data: {
        status: parsed.data.status,
        consumedAt: parsed.data.status === "consumed" ? new Date() : null,
      },
    });
    return ok(item);
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Batch entry not found", 404);
    }
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const batchId = Number(id);
  if (!Number.isInteger(batchId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  try {
    await db.batchInput.delete({ where: { id: batchId } });
    return ok({ deleted: batchId });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Batch entry not found", 404);
    }
    throw e;
  }
}
