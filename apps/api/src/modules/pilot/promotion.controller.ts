import {
  createPromotionSchema,
  patchPromotionSchema,
  promotionListSchema,
  promotionResultSchema,
  promotionSchema,
  promotionsQuerySchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { PromotionService } from "./promotion.service";

const promotions = container.resolve(PromotionService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const promotionController = new Elysia({
  name: "pilot-promotions",
  detail: { tags: ["Pilot"] },
})
  .use(profileGuard)
  .post("/promotions", ({ profileId, body }) => promotions.createPromotion(profileId, body), {
    body: createPromotionSchema,
    beforeHandle: limitMutation,
    response: promotionSchema,
    detail: {
      summary: "Create a promotion draft",
      description:
        "Agent creates a draft self-promotion post for a platform, notifies the user for review, and returns it.",
    },
  })
  .get(
    "/promotions",
    ({ profileId, query }) => promotions.listPromotions(profileId, query.status),
    {
      query: promotionsQuerySchema,
      response: promotionListSchema,
      detail: {
        summary: "List promotion posts",
        description:
          "Returns the profile's promotion posts newest-first, optionally filtered by status.",
      },
    },
  )
  .patch(
    "/promotions/:id",
    ({ profileId, params, body }) => promotions.patchPromotion(profileId, params.id, body),
    {
      params: idParam,
      body: patchPromotionSchema,
      beforeHandle: limitMutation,
      response: promotionSchema,
      detail: {
        summary: "Update a promotion post",
        description:
          "Edits a draft's title/body or moves it draft → approved | declined. Rejects edits on terminal posts.",
      },
    },
  )
  .post(
    "/promotions/:id/result",
    ({ profileId, params, body }) => promotions.recordPromotionResult(profileId, params.id, body),
    {
      params: idParam,
      body: promotionResultSchema,
      beforeHandle: limitMutation,
      response: promotionSchema,
      detail: {
        summary: "Record a promotion post result",
        description:
          "Agent records the terminal outcome (posted/failed/skipped) after posting; stamps postedAt on success.",
      },
    },
  );
