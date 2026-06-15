import { Elysia } from "elysia";
import { container } from "@/common/di";
import { profileGuard } from "@/common/middleware";
import { AnalyticsService } from "./analytics.service";

const analyticsService = container.resolve(AnalyticsService);

export const analyticsController = new Elysia({
  prefix: "/analytics",
  detail: { tags: ["Analytics"] },
})
  .use(profileGuard)
  .get("/", ({ profileId }) => analyticsService.stats(profileId));
