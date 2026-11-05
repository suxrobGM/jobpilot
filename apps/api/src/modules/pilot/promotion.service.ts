import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import {
  type CreatePilotJournalInput,
  type CreatePromotionInput,
  type PatchPromotionInput,
  PROMOTION_TERMINAL_STATUSES,
  type PromotionResultInput,
  type PromotionStatus,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned, unprocessable } from "@/common/errors";
import { publish } from "@/common/sse";
import { PrismaClient, type PromotionPost } from "@/generated/prisma/client";
import { WebPushService } from "@/modules/web-push/web-push.service";
import { PilotJournalService } from "./journal.service";

interface PromotionsQuery extends PaginationQuery {
  status?: PromotionStatus;
}

type Correction = Pick<CreatePilotJournalInput["entries"][number], "summary" | "detail">;

/** A decline or a content edit overrides the agent, so it is journaled as a correction. */
function toCorrection(
  before: PromotionPost,
  after: PromotionPost,
  body: PatchPromotionInput,
): Correction | null {
  const { platform } = before;
  if (body.status === "declined") {
    return {
      summary: `Declined ${platform} post draft.`,
      detail: { type: "promotion.declined", platform, title: before.title, body: before.body },
    };
  }
  if (before.title === after.title && before.body === after.body) return null;
  return {
    summary: `Edited ${platform} post draft.`,
    detail: {
      type: "promotion.edited",
      platform,
      before: { title: before.title, body: before.body },
      after: { title: after.title, body: after.body },
    },
  };
}

@injectable()
export class PromotionService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly push = inject(WebPushService),
    private readonly journal = inject(PilotJournalService),
  ) {}

  private findOwnedPost(userId: string, id: string) {
    return findOwned(
      (where) => this.prisma.promotionPost.findFirst({ where }),
      { id, userId },
      "Promotion post",
    );
  }

  async createPromotion(userId: string, body: CreatePromotionInput) {
    const promotion = await this.prisma.promotionPost.create({
      data: {
        userId,
        platform: body.platform,
        target: body.target ?? null,
        title: body.title ?? null,
        body: body.body,
      },
    });
    publish(pilotChannel, { userId }, { type: "promotion.created", promotion });
    void this.push.sendToUser(userId, {
      title: "Post draft ready for review",
      body: `${promotion.platform}: ${promotion.title ?? promotion.body}`,
      url: "/pilot",
      tag: `promo-${promotion.id}`,
    });
    return promotion;
  }

  async listPromotions(userId: string, query: PromotionsQuery) {
    const where = { userId, status: query.status };
    const [rows, total] = await Promise.all([
      this.prisma.promotionPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        ...pageSlice(query),
      }),
      this.prisma.promotionPost.count({ where }),
    ]);
    return paginate(rows, query, total);
  }

  /** Edits a draft, or moves it to approved or declined. */
  async patchPromotion(userId: string, id: string, body: PatchPromotionInput) {
    const existing = await this.findOwnedPost(userId, id);
    if (PROMOTION_TERMINAL_STATUSES.includes(existing.status)) {
      throw unprocessable(`Post is ${existing.status} and can no longer be edited.`);
    }
    if (body.status && existing.status !== "draft") {
      throw conflict(`Post is already ${existing.status}.`);
    }

    const promotion = await this.prisma.promotionPost.update({
      where: { id },
      data: {
        title: body.title,
        body: body.body,
        status: body.status,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      },
    });
    publish(pilotChannel, { userId }, { type: "promotion.updated", promotion });

    const correction = toCorrection(existing, promotion, body);
    if (correction) {
      await this.journal.appendJournal(userId, {
        entries: [{ kind: "correction", subjectType: "promotion", subjectId: id, ...correction }],
      });
    }
    return promotion;
  }

  /** The agent's posting outcome. Repeating the recorded outcome is a no-op. */
  async recordPromotionResult(userId: string, id: string, body: PromotionResultInput) {
    const posted = body.outcome === "posted";
    const [promotion] = await this.prisma.promotionPost.updateManyAndReturn({
      where: { id, userId, status: "approved" },
      data: {
        status: body.outcome,
        ...(posted ? { postedUrl: body.postedUrl ?? null, postedAt: new Date() } : {}),
      },
    });
    if (!promotion) {
      const existing = await this.findOwnedPost(userId, id);
      if (existing.status === body.outcome) return existing;
      if (PROMOTION_TERMINAL_STATUSES.includes(existing.status)) {
        throw conflict(`Promotion post already finished with outcome ${existing.status}.`);
      }
      throw conflict("Promotion post is not approved.");
    }
    publish(pilotChannel, { userId }, { type: "promotion.updated", promotion });
    return promotion;
  }
}
