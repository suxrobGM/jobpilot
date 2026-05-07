import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { patchRunJobSchema } from "@/lib/schemas/run";
import { publishRunEvent } from "@/lib/sse";

interface Params {
  params: Promise<{ id: string; jobKey: string }>;
}

export async function PATCH(req: Request, ctx: Params) {
  const { id, jobKey } = await ctx.params;
  const body = await req.json();
  const parsed = patchRunJobSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      ErrorCodes.UNPROCESSABLE,
      "Invalid run job patch",
      422,
      parsed.error.issues,
    );
  }

  const existing = await db.runJob.findUnique({
    where: { runId_jobKey: { runId: id, jobKey } },
  });
  if (!existing) return err(ErrorCodes.NOT_FOUND, "Run job not found", 404);

  const job = await db.runJob.update({
    where: { runId_jobKey: { runId: id, jobKey } },
    data: {
      status: parsed.data.status,
      appliedAt:
        parsed.data.appliedAt === undefined
          ? undefined
          : parsed.data.appliedAt
            ? new Date(parsed.data.appliedAt)
            : null,
      failReason: parsed.data.failReason ?? undefined,
      retryNotes: parsed.data.retryNotes ?? undefined,
      skipReason: parsed.data.skipReason ?? undefined,
      matchScore: parsed.data.matchScore ?? undefined,
      matchReason: parsed.data.matchReason ?? undefined,
    },
  });

  publishRunEvent(id, { type: "job-update", payload: { kind: "updated", job } });
  return ok(job);
}
