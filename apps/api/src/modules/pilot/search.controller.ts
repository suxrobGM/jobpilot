import {
  pilotSearchListSchema,
  pilotSearchSchema,
  reportPilotSearchRunSchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { PilotSearchService } from "./search.service";

const searches = container.get(PilotSearchService);
const limitMutation = rateLimit(RATE_LIMITS.pilotMutation);

export const pilotSearchController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
  .get("/searches", ({ user }) => searches.list(user.id), {
    response: pilotSearchListSchema,
    detail: {
      summary: "List pilot searches",
      description: "Returns the user's self-managed discovery searches ordered by next-run time.",
    },
  })
  .post(
    "/searches/:id/runs",
    ({ user, params, body }) => searches.reportRun(user.id, params.id, body),
    {
      params: idParam,
      body: reportPilotSearchRunSchema,
      beforeHandle: limitMutation,
      response: pilotSearchSchema,
      detail: {
        summary: "Report a discovery run's result",
        description:
          "Records a run's jobs-scanned/new-jobs/reached-end and applies the next-run schedule; returns the updated row.",
      },
    },
  );
