import { pilotStepListSchema, postPilotStepsSchema } from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { StepService } from "./step.service";

const steps = container.get(StepService);

export const pilotStepsController = new Elysia({
  prefix: "/pilot/runs",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .post("/:id/steps", ({ user, params, body }) => steps.append(user.id, params.id, body.steps), {
    params: idParam,
    body: postPilotStepsSchema,
    beforeHandle: rateLimit(RATE_LIMITS.pilotSteps),
    response: okResponseSchema,
    detail: {
      summary: "Post a run's live steps",
      description:
        "The host batches readable step labels from the agent's tool calls. Kept in memory, the last 100 per run.",
    },
  })
  .get("/:id/steps", ({ user, params }) => steps.list(user.id, params.id), {
    params: idParam,
    response: pilotStepListSchema,
    detail: {
      summary: "Read a run's live steps",
      description: "The steps so far, oldest first, for a viewer who joins mid-run.",
    },
  });
