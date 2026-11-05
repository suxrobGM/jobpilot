import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { researchStatusSchema } from "./pilot.schema";
import { ResearchService } from "./research.service";

const research = container.get(ResearchService);

export const pilotResearchController = new Elysia({
  prefix: "/pilot",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .get("/research", ({ user }) => research.getStatus(user.id), {
    response: researchStatusSchema,
    detail: {
      summary: "Get the research status",
      description:
        "Returns the last research run with its summary, the standing research campaign, and any pending Research now request.",
    },
  })
  .post("/research/runs", ({ user }) => research.runNow(user.id), {
    beforeHandle: rateLimit(RATE_LIMITS.pilotMutation),
    response: researchStatusSchema,
    detail: {
      summary: "Research now",
      description:
        "Queues a research run for the next pilot cycle, past the quiet-pipeline gate, resumes a paused research campaign, and wakes the pilot. The request lapses after an hour if the pilot never gets to it.",
    },
  });
