import {
  createPilotSearchSchema,
  pilotSearchListSchema,
  pilotSearchSchema,
  reportPilotSearchRunSchema,
  updatePilotSearchSchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { deletedResponseSchema } from "@/types/response";
import { PilotSearchService } from "./pilot-search.service";

const searches = container.resolve(PilotSearchService);
const limitAgenda = rateLimit(RATE_LIMITS.pilotAgenda);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotSearchController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
  .get("/searches", ({ user }) => searches.list(user.id), {
    beforeHandle: limitAgenda,
    response: pilotSearchListSchema,
    detail: {
      summary: "List pilot searches",
      description:
        "Returns the profile's self-managed discovery searches ordered by next-run time.",
    },
  })
  .post("/searches", ({ user, body }) => searches.create(user.id, body), {
    body: createPilotSearchSchema,
    beforeHandle: limitMutation,
    response: pilotSearchSchema,
    detail: {
      summary: "Create a pilot search",
      description:
        "Creates a discovery search due immediately; a duplicate query+board for the profile returns 409.",
    },
  })
  .patch("/searches/:id", ({ user, params, body }) => searches.update(user.id, params.id, body), {
    params: idParam,
    body: updatePilotSearchSchema,
    beforeHandle: limitMutation,
    response: pilotSearchSchema,
    detail: {
      summary: "Update a pilot search",
      description:
        "Patches a search; changing its query or board restarts scheduling and returns the updated row.",
    },
  })
  .delete("/searches/:id", ({ user, params }) => searches.remove(user.id, params.id), {
    params: idParam,
    beforeHandle: limitMutation,
    response: deletedResponseSchema,
    detail: {
      summary: "Delete a pilot search",
      description: "Deletes the profile's search by id and returns the id of the removed row.",
    },
  })
  .post(
    "/searches/:id/run-result",
    ({ user, params, body }) => searches.reportRun(user.id, params.id, body),
    {
      params: idParam,
      body: reportPilotSearchRunSchema,
      beforeHandle: limitMutation,
      response: pilotSearchSchema,
      detail: {
        summary: "Report a discovery run's result",
        description:
          "Records a run's jobs-seen/new-jobs/reached-end and applies the next-run schedule; returns the updated row.",
      },
    },
  );
