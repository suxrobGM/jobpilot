import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { analyticsStatsSchema } from "./analytics.schema";
import { AnalyticsService } from "./analytics.service";

const analyticsService = container.resolve(AnalyticsService);

export const analyticsController = new Elysia({
  prefix: "/analytics",
  detail: { tags: ["Analytics"] },
})
  .use(authGuard)
  .get("/", ({ user }) => analyticsService.stats(user.id), {
    response: analyticsStatsSchema,
    detail: {
      summary: "Get dashboard analytics summary",
      description:
        "Aggregates the active profile's application and networking activity into a single dashboard summary, returning totals, this-week counts, response and reply rates, stage breakdown, 30-day per-day timelines, and top boards, reject reasons, and contact sources.",
    },
  });
