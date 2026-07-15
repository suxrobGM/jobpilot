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
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { toPromotion } from "./pilot.mapper";
import { PushService } from "./push.service";

/** Push bodies are glanceable; keep them short so a phone banner never truncates mid-word. */
const PUSH_BODY_MAX = 120;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

@singleton()
export class PromotionService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly push: PushService,
  ) {}

  /** Agent creates a draft post for review; notifies the user to look it over. */
  async createPromotion(profileId: string, body: CreatePromotionInput) {
    const row = await this.prisma.promotionPost.create({
      data: {
        profileId,
        venue: body.venue,
        target: body.target ?? null,
        title: body.title ?? null,
        body: body.body,
      },
    });
    const promotion = toPromotion(row);
    publish(pilotChannel, { profileId }, { type: "promotion.created", promotion });
    void this.push.sendToProfile(profileId, {
      title: "Post draft ready for review",
      body: truncate(`${row.venue}: ${row.title ?? row.body}`, PUSH_BODY_MAX),
      url: "/pilot",
      tag: `promo-${row.id}`,
    });
    return promotion;
  }

  async listPromotions(profileId: string, status?: PromotionStatus) {
    const rows = await this.prisma.promotionPost.findMany({
      where: { profileId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map(toPromotion);
  }

  /** User edits a draft's title/body or moves it draft → approved | declined. Terminal posts are locked. */
  async patchPromotion(profileId: string, id: string, body: PatchPromotionInput) {
    const existing = await findOwned(
      (where) => this.prisma.promotionPost.findFirst({ where }),
      { id, profileId },
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
    publish(pilotChannel, { profileId }, { type: "promotion.updated", promotion });
    return promotion;
  }

  /** Agent records the terminal outcome after posting; stamps postedAt on success. */
  async recordPromotionResult(profileId: string, id: string, body: PromotionResultInput) {
    await findOwned(
      (where) => this.prisma.promotionPost.findFirst({ where, select: { id: true } }),
      { id, profileId },
      "Promotion post",
    );
    const row = await this.prisma.promotionPost.update({
      where: { id },
      data: {
        status: body.outcome,
        postedUrl: body.outcome === "posted" ? (body.postedUrl ?? null) : undefined,
        postedAt: body.outcome === "posted" ? new Date() : undefined,
      },
    });
    const promotion = toPromotion(row);
    publish(pilotChannel, { profileId }, { type: "promotion.updated", promotion });
    return promotion;
  }
}
