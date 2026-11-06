import {
  createFeedSchema,
  feedListSchema,
  feedSchema,
  feedsQuerySchema,
  reportSearchRunSchema,
  updateFeedSchema,
} from "@jobpilot/contracts/feed";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { FeedService } from "./feed.service";

const feeds = container.get(FeedService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const feedController = new Elysia({ prefix: "/feeds", detail: { tags: ["Feeds"] } })
  .use(authGuard)
  .get("/", ({ user, query }) => feeds.list(user.id, query.kind), {
    query: feedsQuerySchema,
    response: feedListSchema,
    detail: {
      summary: "List feeds",
      description:
        "Returns the user's feeds, optionally of one kind, each with the applications it produced this week.",
    },
  })
  .post("/", ({ user, body }) => feeds.ensure(user.id, body.kind), {
    body: createFeedSchema,
    beforeHandle: limitMutation,
    response: feedSchema,
    detail: {
      summary: "Get or create a feed",
      description:
        "Returns the user's one feed of the kind, creating it first. Searches are created through pilot changes.",
    },
  })
  .get("/:id", ({ user, params }) => feeds.get(user.id, params.id), {
    params: idParam,
    response: feedSchema,
    detail: { summary: "Get a feed", description: "Returns one feed the user owns." },
  })
  .patch("/:id", ({ user, params, body }) => feeds.setPaused(user.id, params.id, body), {
    params: idParam,
    body: updateFeedSchema,
    beforeHandle: limitMutation,
    response: feedSchema,
    detail: {
      summary: "Pause or resume a feed",
      description:
        "A paused feed drops out of the pilot's gathering. Records who paused it and why, and drops the cached task list.",
    },
  })
  .post("/:id/runs", ({ user, params, body }) => feeds.reportRun(user.id, params.id, body), {
    params: idParam,
    body: reportSearchRunSchema,
    beforeHandle: limitMutation,
    response: feedSchema,
    detail: {
      summary: "Report a discovery run's result",
      description:
        "Records a search run's jobs scanned, new jobs and whether it reached the board's end, and schedules the next run.",
    },
  });
