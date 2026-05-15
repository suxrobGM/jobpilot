import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { approveSchema } from "@/lib/schemas/email";
import { publishInboxEvent } from "@/lib/sse/inbox-events";

type Params = ApiRouteContext<{ id: string }>;

const POSITIVE_STAGES = new Set([
  "recruiter_screen",
  "assessment",
  "hiring_manager_screen",
  "technical_interview",
  "onsite",
  "offer",
]);

const CLASSIFICATION_TO_STAGE: Record<string, string> = {
  interviewing: "recruiter_screen",
  rejected: "rejected",
  offer: "offer",
};

export async function POST(req: Request, ctx: Params) {
  const { id } = await parsePathParams(ctx);
  const msgId = Number(id);
  if (!Number.isInteger(msgId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid approve payload", 422, parsed.error.issues);
  }

  const message = await db.emailMessage.findUnique({ where: { id: msgId } });
  if (!message) return err(ErrorCodes.NOT_FOUND, "Message not found", 404);
  if (!message.matchedAppId) {
    return err(ErrorCodes.UNPROCESSABLE, "Message has no matched application", 422);
  }

  const inferred =
    parsed.data.toStage ??
    message.appliedStage ??
    (message.classification ? CLASSIFICATION_TO_STAGE[message.classification] : undefined);
  if (!inferred) {
    return err(ErrorCodes.UNPROCESSABLE, "No target stage available", 422);
  }

  const app = await db.application.findUnique({ where: { id: message.matchedAppId } });
  if (!app) return err(ErrorCodes.NOT_FOUND, "Application not found", 404);

  const fromStage = app.stage;
  const toStage = inferred;
  const outcome =
    toStage === "rejected" ? "negative" : POSITIVE_STAGES.has(toStage) ? "positive" : null;
  const rejectedAt = toStage === "rejected" ? new Date() : null;

  await db.$transaction([
    db.application.update({
      where: { id: app.id },
      data: { stage: toStage, outcome, rejectedAt },
    }),
    db.stageEvent.create({
      data: {
        applicationId: app.id,
        fromStage,
        toStage,
        note: parsed.data.note ?? `From email: ${message.subject}`,
      },
    }),
    db.emailMessage.update({
      where: { id: msgId },
      data: { reviewStatus: "approved", appliedStage: toStage },
    }),
  ]);

  publishInboxEvent({ type: "message.reviewed", id: msgId, status: "approved" });

  return ok({ id: msgId, applicationId: app.id, stage: toStage });
}
