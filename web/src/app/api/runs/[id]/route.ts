import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { updateRunSchema } from "@/lib/schemas/run";
import { publishRunEvent } from "@/lib/sse";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const run = await db.run.findUnique({
    where: { runId: id },
    include: { jobs: { orderBy: { id: "asc" } } },
  });
  if (!run) return err(ErrorCodes.NOT_FOUND, "Run not found", 404);
  return ok({
    ...run,
    config: JSON.parse(run.config) as Record<string, unknown>,
    summary: JSON.parse(run.summary) as Record<string, unknown>,
  });
}

export async function PATCH(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = updateRunSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      ErrorCodes.UNPROCESSABLE,
      "Invalid run patch",
      422,
      parsed.error.issues,
    );
  }
  const existing = await db.run.findUnique({ where: { runId: id } });
  if (!existing) return err(ErrorCodes.NOT_FOUND, "Run not found", 404);

  const summaryNext = parsed.data.summary
    ? {
        ...(JSON.parse(existing.summary) as Record<string, unknown>),
        ...parsed.data.summary,
      }
    : undefined;

  const run = await db.run.update({
    where: { runId: id },
    data: {
      status: parsed.data.status,
      completedAt:
        parsed.data.completedAt === undefined
          ? undefined
          : parsed.data.completedAt
            ? new Date(parsed.data.completedAt)
            : null,
      summary: summaryNext === undefined ? undefined : JSON.stringify(summaryNext),
    },
  });

  if (parsed.data.status) {
    publishRunEvent(id, { type: "status", payload: { status: parsed.data.status } });
  }
  if (summaryNext) {
    publishRunEvent(id, { type: "progress", payload: summaryNext });
  }

  return ok({
    ...run,
    config: JSON.parse(run.config) as Record<string, unknown>,
    summary: JSON.parse(run.summary) as Record<string, unknown>,
  });
}
