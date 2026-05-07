import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { jobBoardPatchSchema } from "@/lib/schemas/job-board";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const boardId = Number(id);
  if (!Number.isInteger(boardId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  const body = await req.json();
  const parsed = jobBoardPatchSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid patch", 422, parsed.error.issues);
  }
  try {
    const board = await db.jobBoard.update({
      where: { id: boardId },
      data: parsed.data,
    });
    return ok(board);
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Board not found", 404);
    }
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const boardId = Number(id);
  if (!Number.isInteger(boardId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }
  try {
    await db.jobBoard.delete({ where: { id: boardId } });
    return ok({ deleted: boardId });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") {
      return err(ErrorCodes.NOT_FOUND, "Board not found", 404);
    }
    throw e;
  }
}
