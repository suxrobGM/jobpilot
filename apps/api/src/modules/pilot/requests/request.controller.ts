import { createPilotRequestBodySchema, pilotRequestSchema } from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { RequestService } from "./request.service";

const requests = container.get(RequestService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotRequestsController = new Elysia({
  prefix: "/pilot/requests",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .post(
    "/",
    ({ user, body }) => {
      const { source, ...input } = body;
      return requests.create(user.id, input, source);
    },
    {
      body: createPilotRequestBodySchema,
      beforeHandle: limitMutation,
      response: pilotRequestSchema,
      detail: {
        summary: "Ask the pilot for work",
        description:
          "Queues a task the user asked for by name. It runs as a normal pilot run ahead of autonomous work, with autopilot on or off.",
      },
    },
  )
  .post("/:id/cancel", ({ user, params }) => requests.cancel(user.id, params.id), {
    params: idParam,
    beforeHandle: limitMutation,
    response: pilotRequestSchema,
    detail: {
      summary: "Cancel queued work",
      description: "Stops a request that hasn't started. A running one finishes with its run.",
    },
  });
