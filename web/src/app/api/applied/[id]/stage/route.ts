import { ErrorCodes, err, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { stageTransitionSchema } from "@/lib/schemas/application";

interface Params {
  params: Promise<{ id: string }>;
}

const POSITIVE_STAGES = new Set([
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
]);

export async function POST(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  const appId = Number(id);
  if (!Number.isInteger(appId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const body = await req.json();
  const parsed = stageTransitionSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      ErrorCodes.UNPROCESSABLE,
      "Invalid stage transition",
      422,
      parsed.error.issues,
    );
  }

  const existing = await db.application.findUnique({ where: { id: appId } });
  if (!existing) return err(ErrorCodes.NOT_FOUND, "Application not found", 404);

  const fromStage = existing.stage;
  const toStage = parsed.data.toStage;
  if (fromStage === toStage) {
    return ok({ id: appId, stage: toStage, unchanged: true });
  }

  const outcome =
    toStage === "rejected"
      ? "negative"
      : POSITIVE_STAGES.has(toStage)
        ? "positive"
        : null;
  const rejectedAt = toStage === "rejected" ? new Date() : null;

  await db.$transaction([
    db.application.update({
      where: { id: appId },
      data: { stage: toStage, outcome, rejectedAt },
    }),
    db.stageEvent.create({
      data: {
        applicationId: appId,
        fromStage,
        toStage,
        note: parsed.data.note ?? null,
      },
    }),
  ]);

  return ok({ id: appId, stage: toStage });
}
