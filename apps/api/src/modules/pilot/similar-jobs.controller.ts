import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { similarJobsBodySchema, similarJobsSchema } from "./pilot.schema";
import { SimilarJobsService } from "./similar-jobs.service";

const similarJobs = container.get(SimilarJobsService);

export const pilotSimilarJobsController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .post("/jobs/similar", ({ user, body }) => similarJobs.findSimilar(user.id, body), {
    body: similarJobsBodySchema,
    beforeHandle: rateLimit(RATE_LIMITS.pilotMutation),
    response: similarJobsSchema,
    detail: {
      summary: "Find campaign jobs similar to given postings",
      description:
        "For each posting (title, company), returns the closest fuzzy match among the user's campaign jobs from the last `withinDays` days (default 30), skipped rows included. The same title at one employer can be a different role, so a match is a hint for the caller to judge. Read-only.",
    },
  });
