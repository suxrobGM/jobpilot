import type { ApplicationStatus } from "@jobpilot/contracts/application";
import {
  type ApproveInput,
  CLASSIFICATION_TO_STATUS,
  type Classification,
  type ScanMessageInput,
} from "@jobpilot/contracts/email";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { inboxChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { ErrorCodes, findOwned, HttpError, notFound } from "@/common/errors";
import { publish } from "@/common/sse";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { statusChangeOps } from "@/modules/application/status-change";
import { AUTO_REJECTION_FROM_STATUSES, isAutoRejection, needsHumanReview } from "./auto-rejection";
import { serializeMessage } from "./email.mapper";
import { emailStatusNote, verdictOps } from "./verdict";

interface MessageQuery {
  reviewStatus?: string;
  classification?: string;
  since?: string;
  domainHint?: string;
  verificationDomain?: string;
}

@singleton()
export class EmailService {
  constructor(private readonly prisma: PrismaClient) {}

  private messageWhere(userId: string, query: MessageQuery): Prisma.EmailMessageWhereInput {
    const { reviewStatus, classification, since, domainHint, verificationDomain } = query;

    const where: Prisma.EmailMessageWhereInput = { account: { userId } };

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

    return where;
  }

  /** Just the total, for callers that render a number and would otherwise page a row to get it. */
  async countMessages(userId: string, query: MessageQuery) {
    return {
      count: await this.prisma.emailMessage.count({ where: this.messageWhere(userId, query) }),
    };
  }

  async listMessages(userId: string, query: PaginationQuery & MessageQuery) {
    const where = this.messageWhere(userId, query);

    const [rows, total] = await Promise.all([
      this.prisma.emailMessage.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        ...pageSlice(query),
        include: {
          matchedApp: { select: { id: true, title: true, company: true, status: true } },
        },
      }),
      this.prisma.emailMessage.count({ where }),
    ]);

    return paginate(
      rows.map((row) => serializeMessage(row)),
      query,
      total,
    );
  }

  async getMessage(userId: string, id: string) {
    const row = await findOwned(
      (where) =>
        this.prisma.emailMessage.findFirst({
          where,
          include: {
            matchedApp: { select: { id: true, title: true, company: true, status: true } },
          },
        }),
      { id, account: { userId } },
      "Message",
    );

    return serializeMessage(row);
  }

  /**
   * A confidently-matched rejection applies without asking: 100+ applications produce more
   * rejections than anyone clicks through, and a stale funnel is the result. See `auto-rejection`.
   */
  private async resolveAutoRejection(
    userId: string,
    body: ScanMessageInput,
  ): Promise<{ applicationId: string; fromStatus: ApplicationStatus } | null> {
    if (!isAutoRejection(body)) {
      return null;
    }

    const app = await this.prisma.application.findFirst({
      where: { id: body.matchedAppId, userId, status: { in: [...AUTO_REJECTION_FROM_STATUSES] } },
      select: { id: true, status: true },
    });

    return app ? { applicationId: app.id, fromStatus: app.status } : null;
  }

  async scanMessage(userId: string, id: string, body: ScanMessageInput) {
    // Independent reads: the auto-rejection lookup is scoped to the user itself, so it needs no
    // ownership result to be safe.
    const [existing, autoRejection] = await Promise.all([
      findOwned(
        (where) =>
          this.prisma.emailMessage.findFirst({ where, select: { id: true, subject: true } }),
        { id, account: { userId } },
        "Message",
      ),
      this.resolveAutoRejection(userId, body),
    ]);

    // `auto` means "the server applied it", so an interview or offer left there hides from the queue.
    const reviewStatus = needsHumanReview(body) ? "pending" : body.reviewStatus;

    const update = this.prisma.emailMessage.update({
      where: { id },
      data: {
        classification: body.classification,
        confidence: body.confidence,
        reasoning: body.reasoning,
        matchedAppId: body.matchedAppId,
        matchScore: body.matchScore,
        // Applied below, so the row is already reviewed and carries the status it applied -
        // leaving it "auto" would re-offer it.
        appliedStatus: autoRejection ? "rejected" : body.appliedStatus,
        reviewStatus: autoRejection ? "approved" : reviewStatus,
        verificationCode: body.verificationCode,
        verificationLink: body.verificationLink,
        verificationDomain: body.verificationDomain,
        scannedAt: body.classification ? new Date() : undefined,
      },
      include: {
        matchedApp: { select: { id: true, title: true, company: true, status: true } },
      },
    });

    // Batched, not interactive: a half-applied rejection is the stale-funnel bug, but the common
    // scan carries no transition and shouldn't pay for a round-trip-per-statement transaction.
    const [row] = autoRejection
      ? await this.prisma.$transaction([
          update,
          ...statusChangeOps(this.prisma, {
            applicationId: autoRejection.applicationId,
            fromStatus: autoRejection.fromStatus,
            toStatus: "rejected",
            source: "email",
            note: emailStatusNote(existing.subject),
          }),
        ])
      : [await update];

    const message = serializeMessage(row);

    publish(inboxChannel, { userId }, { type: "message.scanned", id });
    if (autoRejection) {
      publish(inboxChannel, { userId }, { type: "message.reviewed", id, status: "approved" });
    }

    return message;
  }

  async denyMessage(userId: string, id: string) {
    await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where, select: { id: true } }),
      { id, account: { userId } },
      "Message",
    );

    await this.prisma.emailMessage.update({
      where: { id },
      data: { reviewStatus: "denied" },
    });

    publish(inboxChannel, { userId }, { type: "message.reviewed", id, status: "denied" });

    return { id, status: "denied" as const };
  }

  async approveMessage(userId: string, id: string, body: ApproveInput) {
    const message = await findOwned(
      (where) => this.prisma.emailMessage.findFirst({ where }),
      { id, account: { userId } },
      "Message",
    );

    if (!message.matchedAppId) {
      throw new HttpError(ErrorCodes.UNPROCESSABLE, "Message has no matched application", 422);
    }

    const inferred: ApplicationStatus | undefined =
      body.toStatus ??
      (message.appliedStatus as ApplicationStatus | null) ??
      CLASSIFICATION_TO_STATUS[message.classification as Classification];

    if (!inferred) {
      throw new HttpError(ErrorCodes.UNPROCESSABLE, "No target status available", 422);
    }

    const app = await this.prisma.application.findFirst({
      where: { id: message.matchedAppId, userId },
    });
    if (!app) {
      throw notFound("Application not found");
    }

    await this.prisma.$transaction(
      verdictOps(this.prisma, {
        messageId: id,
        applicationId: app.id,
        fromStatus: app.status,
        toStatus: inferred,
        subject: message.subject,
        note: body.note,
      }),
    );

    publish(inboxChannel, { userId }, { type: "message.reviewed", id, status: "approved" });

    return { id, applicationId: app.id, status: inferred };
  }
}
