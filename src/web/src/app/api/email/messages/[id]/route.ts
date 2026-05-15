import { err, ErrorCodes, ok } from "@/lib/api";
import { type ApiRouteContext, parsePathParams } from "@/lib/api/request";
import { db } from "@/lib/db";
import { scanMessageSchema } from "@/lib/schemas/email";
import { publishInboxEvent } from "@/lib/sse/inbox-events";

type Params = ApiRouteContext<{ id: string }>;

export async function GET(_req: Request, ctx: Params) {
  const { id } = await parsePathParams(ctx);
  const msgId = Number(id);
  if (!Number.isInteger(msgId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const message = await db.emailMessage.findUnique({
    where: { id: msgId },
    include: {
      matchedApp: { select: { id: true, title: true, company: true, stage: true } },
    },
  });
  if (!message) {
    return err(ErrorCodes.NOT_FOUND, "Message not found", 404);
  }
  return ok(message);
}

export async function PATCH(req: Request, ctx: Params) {
  const { id } = await parsePathParams(ctx);
  const msgId = Number(id);
  if (!Number.isInteger(msgId)) {
    return err(ErrorCodes.INVALID_REQUEST, "Invalid id", 400);
  }

  const body = await req.json();
  const parsed = scanMessageSchema.safeParse(body);
  if (!parsed.success) {
    return err(ErrorCodes.UNPROCESSABLE, "Invalid scan payload", 422, parsed.error.issues);
  }

  const data = parsed.data;
  const message = await db.emailMessage.update({
    where: { id: msgId },
    data: {
      classification: data.classification,
      confidence: data.confidence,
      reasoning: data.reasoning,
      matchedAppId: data.matchedAppId,
      matchScore: data.matchScore,
      appliedStage: data.appliedStage,
      reviewStatus: data.reviewStatus,
      verificationCode: data.verificationCode,
      verificationLink: data.verificationLink,
      verificationDomain: data.verificationDomain,
      scannedAt: data.classification ? new Date() : undefined,
    },
  });

  publishInboxEvent({ type: "message.scanned", id: msgId });

  return ok(message);
}
