import type {
  CreatePromotionInput,
  PatchPromotionInput,
  PromotionResultInput,
  PromotionStatus,
} from "@jobpilot/contracts/pilot";
import { PROMOTION_TERMINAL_STATUSES } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned, unprocessable } from "@/common/errors";
import { PushService } from "@/common/push";
import { publish } from "@/common/sse";
import { PrismaClient, type PromotionPost as PromotionPostModel } from "@/generated/prisma/client";
import { PilotJournalService } from "./journal.service";
import { toPromotion } from "./pilot.mapper";

@singleton()
export class PromotionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
    private readonly pilot: PilotJournalService,
  ) {}

  /** Agent creates a draft post for review; notifies the user to look it over. */
  async createPromotion(userId: string, body: CreatePromotionInput) {
    const row = await this.prisma.promotionPost.create({
      data: {
        userId,
        platform: body.platform,
        target: body.target ?? null,
        title: body.title ?? null,
        body: body.body,
      },
    });
    const promotion = toPromotion(row);
    publish(pilotChannel, { userId }, { type: "promotion.created", promotion });
    void this.push.sendToUser(userId, {
      title: "Post draft ready for review",
      body: `${row.platform}: ${row.title ?? row.body}`,
      url: "/pilot",
      tag: `promo-${row.id}`,
    });
    return promotion;
  }

  async listPromotions(userId: string, status?: PromotionStatus) {
    const rows = await this.prisma.promotionPost.findMany({
      where: { userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toPromotion);
  }

  /** User edits a draft's title/body or moves it draft → approved | declined. Terminal posts are locked. */
  async patchPromotion(userId: string, id: string, body: PatchPromotionInput) {
    const existing = await findOwned(
      (where) => this.prisma.promotionPost.findFirst({ where }),
      { id, userId },
      "Promotion post",
    );
    if (PROMOTION_TERMINAL_STATUSES.includes(existing.status)) {
      throw unprocessable(`Post is ${existing.status} and can no longer be edited.`);
    }
    // Approve/decline only makes sense from a draft; block re-transitions.
    if (body.status && existing.status !== "draft") {
      throw conflict(`Post is already ${existing.status}.`);
    }

    const row = await this.prisma.promotionPost.update({
      where: { id },
      data: {
        title: body.title,
        body: body.body,
        status: body.status,
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : undefined,
      },
    });
    const promotion = toPromotion(row);
    publish(pilotChannel, { userId }, { type: "promotion.updated", promotion });
    await this.captureCorrection(userId, id, existing, body, row);
    return promotion;
  }

  /** A decline or a content edit of a draft is a user override; log it as a correction signal. */
  private async captureCorrection(
    userId: string,
    id: string,
    before: PromotionPostModel,
    body: PatchPromotionInput,
    after: PromotionPostModel,
  ): Promise<void> {
    if (body.status === "declined") {
      await this.pilot.appendJournal(userId, {
        entries: [
          {
            kind: "correction",
            summary: `Declined ${before.platform} post draft.`,
            detail: {
              type: "promotion.declined",
              platform: before.platform,
              title: before.title,
              body: before.body,
            },
            subjectType: "promotion",
            subjectId: id,
          },
        ],
      });
      return;
    }

    const titleChanged = body.title !== undefined && body.title !== before.title;
    const bodyChanged = body.body !== undefined && body.body !== before.body;
    if (!titleChanged && !bodyChanged) return;

    await this.pilot.appendJournal(userId, {
      entries: [
        {
          kind: "correction",
          summary: `Edited ${before.platform} post draft.`,
          detail: {
            type: "promotion.edited",
            platform: before.platform,
            before: { title: before.title, body: before.body },
            after: { title: after.title, body: after.body },
          },
          subjectType: "promotion",
          subjectId: id,
        },
      ],
    });
  }

  /** Agent records the terminal outcome after posting; stamps postedAt on success. */
  async recordPromotionResult(userId: string, id: string, body: PromotionResultInput) {
    await findOwned(
      (where) => this.prisma.promotionPost.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Promotion post",
    );
    // Approval gate lives in the write: a draft/declined post must never flip to posted, and an
    // already-terminal row must not be silently overwritten by a second result call.
    const { count } = await this.prisma.promotionPost.updateMany({
      where: { id, userId, status: "approved" },
      data: {
        status: body.outcome,
        postedUrl: body.outcome === "posted" ? (body.postedUrl ?? null) : undefined,
        postedAt: body.outcome === "posted" ? new Date() : undefined,
      },
    });
    if (count === 0) throw conflict("Promotion post is not approved.");

    const row = await findOwned(
      (where) => this.prisma.promotionPost.findFirst({ where }),
      { id, userId },
      "Promotion post",
    );
    const promotion = toPromotion(row);
    publish(pilotChannel, { userId }, { type: "promotion.updated", promotion });
    return promotion;
  }
}
