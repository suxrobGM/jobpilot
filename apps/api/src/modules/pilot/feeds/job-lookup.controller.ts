import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { APPLIED_DUPLICATE_WINDOW_DAYS } from "@/modules/scoring/applied-duplicates";
import {
  existingJobsBodySchema,
  existingJobsSchema,
  similarJobsBodySchema,
  similarJobsSchema,
} from "../pilot.schema";
import { JobLookupService } from "./job-lookup.service";

const lookup = container.get(JobLookupService);

export const pilotJobLookupController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .post("/jobs/existing", ({ user, body }) => lookup.findExisting(user.id, body), {
    body: existingJobsBodySchema,
    beforeHandle: rateLimit(RATE_LIMITS.pilotMutation),
    response: existingJobsSchema,
    detail: {
      summary: "Find postings already in a feed",
      description:
        "Returns the given URLs, as sent, whose normalized form is already a job in one of the user's feeds from the last `withinDays` days (default 7). Read-only.",
    },
  })
  .post("/jobs/similar", ({ user, body }) => lookup.findSimilar(user.id, body), {
    body: similarJobsBodySchema,
    beforeHandle: rateLimit(RATE_LIMITS.pilotMutation),
    response: similarJobsSchema,
    detail: {
      summary: "Find feed jobs similar to given postings",
      description: `For each posting (title, company), returns the closest fuzzy match among the user's feed jobs from the last \`withinDays\` days (default ${APPLIED_DUPLICATE_WINDOW_DAYS}), skipped rows included. The same title at one employer can be a different role, so a match is a hint for the caller to judge. Read-only.`,
    },
  });
