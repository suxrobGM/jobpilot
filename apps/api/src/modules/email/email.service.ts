import type { ApproveInput, ScanMessageInput } from "@jobpilot/contracts/email";
import { singleton } from "tsyringe";
import { ErrorCodes, findOwned, HttpError, notFound } from "@/common/errors";
import { publish } from "@/common/sse";
import { inboxChannel } from "@/common/sse/channels/inbox";
import { PrismaClient, type Prisma } from "@/generated/prisma/client";
import { serializeMessage } from "./email.mapper";

interface MessageQuery {
  reviewStatus?: string;
  classification?: string;
  since?: string;
  domainHint?: string;
  verificationDomain?: string;
}

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

@singleton()
export class EmailService {
  constructor(private readonly prisma: PrismaClient) {}

  async listMessages(profileId: number, query: MessageQuery) {
    const { reviewStatus, classification, since, domainHint, verificationDomain } = query;

    const where: Prisma.EmailMessageWhereInput = { account: { profileId } };

    if (reviewStatus) {
      where.reviewStatus = reviewStatus;
    }
    if (classification === "null") {
      where.classification = null;
    } else if (classification) {
      where.classification = classification;
    }
    if (since) {
      const date = new Date(since);
      if (!Number.isNaN(date.getTime())) where.receivedAt = { gte: date };
    }
    if (verificationDomain) {
      where.verificationDomain = verificationDomain;
    }
    if (domainHint) {
      where.OR = [
        { fromDomain: { contains: domainHint } },
        { subject: { contains: domainHint } },
        { rawBody: { contains: domainHint } },
      ];
    }

    const rows = await this.prisma.emailMessage.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
      include: {
        matchedApp: { select: { id: true, title: true, company: true, stage: true } },
      },
    });

    return rows.map((row) => serializeMessage(row));
  }

  async getMessage(profileId: number, id: number) {
    const row = await findOwned(
      (where) =>
        this.prisma.emailMessage.findFirst({
          where,
          include: {
            matchedApp: { select: { id: true, title: true, company: true, stage: true } },
          },
        }),
      { id, account: { profileId } },
      "Message",
    );

    return serializeMessage(row);
  }

  async scanMessage(profileId: number, id: number, body: ScanMessageInput) {
    await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where, select: { id: true } }),
      { id, account: { profileId } },
      "Message",
    );

    const row = await this.prisma.emailMessage.update({
      where: { id },
      data: {
        classification: body.classification,
        confidence: body.confidence,
        reasoning: body.reasoning,
        matchedAppId: body.matchedAppId,
        matchScore: body.matchScore,
        appliedStage: body.appliedStage,
        reviewStatus: body.reviewStatus,
        verificationCode: body.verificationCode,
        verificationLink: body.verificationLink,
        verificationDomain: body.verificationDomain,
        scannedAt: body.classification ? new Date() : undefined,
      },
    });

    const message = serializeMessage(row);

    publish(inboxChannel, undefined, { type: "message.scanned", id });

    return message;
  }

  async denyMessage(profileId: number, id: number) {
    await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where, select: { id: true } }),
      { id, account: { profileId } },
      "Message",
    );

    await this.prisma.emailMessage.update({
      where: { id },
      data: { reviewStatus: "denied" },
    });

    publish(inboxChannel, undefined, { type: "message.reviewed", id, status: "denied" });

    return { id, status: "denied" as const };
  }

  async approveMessage(profileId: number, id: number, body: ApproveInput) {
    const message = await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where }),
      { id, account: { profileId } },
      "Message",
    );

    if (!message.matchedAppId) {
      throw new HttpError(ErrorCodes.UNPROCESSABLE, "Message has no matched application", 422);
    }

    const inferred =
      body.toStage ??
      message.appliedStage ??
      (message.classification ? CLASSIFICATION_TO_STAGE[message.classification] : undefined);

    if (!inferred) {
      throw new HttpError(ErrorCodes.UNPROCESSABLE, "No target stage available", 422);
    }

    const app = await this.prisma.application.findFirst({
      where: { id: message.matchedAppId, profileId },
    });
    if (!app) {
      throw notFound("Application not found");
    }

    const fromStage = app.stage;
    const toStage = inferred;
    const outcome =
      toStage === "rejected" ? "negative" : POSITIVE_STAGES.has(toStage) ? "positive" : null;
    const rejectedAt = toStage === "rejected" ? new Date() : null;

    await this.prisma.$transaction([
      this.prisma.application.update({
        where: { id: app.id },
        data: { stage: toStage, outcome, rejectedAt },
      }),
      this.prisma.stageEvent.create({
        data: {
          applicationId: app.id,
          fromStage,
          toStage,
          note: body.note ?? `From email: ${message.subject}`,
        },
      }),
      this.prisma.emailMessage.update({
        where: { id },
        data: { reviewStatus: "approved", appliedStage: toStage },
      }),
    ]);

    publish(inboxChannel, undefined, { type: "message.reviewed", id, status: "approved" });

    return { id, applicationId: app.id, stage: toStage };
  }
}
