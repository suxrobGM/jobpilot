import {
  pilotRunHistoryPageSchema,
  pilotRunHistoryQuerySchema,
  pilotRunResultSchema,
  pilotRunSchema,
  pilotStepListSchema,
  postPilotStepsSchema,
  reportPilotUsageSchema,
  startPilotRunSchema,
  steerPilotRunSchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { RunService } from "./run.service";
import { RunListService } from "./run-list.service";
import { StepService } from "./step.service";

const runs = container.get(RunService);
const runList = container.get(RunListService);
const steps = container.get(StepService);
const limitRun = rateLimit(RATE_LIMITS.pilotRun);

export const pilotRunsController = new Elysia({
  prefix: "/pilot/runs",
  detail: { tags: ["Pilot"] },
})
  .use(authGuard)
  .post("/", ({ user, body }) => runs.start(user.id, body.taskId), {
    body: startPilotRunSchema,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Start a task run",
      description:
        "Starts a task from the live task list as a 15-minute run. An expired list, a missing task or a race returns 409.",
    },
  })
  .get("/", ({ user, query }) => runList.list(user.id, query), {
    query: pilotRunHistoryQuerySchema,
    beforeHandle: rateLimit(RATE_LIMITS.pilotTasks),
    response: pilotRunHistoryPageSchema,
    detail: {
      summary: "List finished runs",
      description: "Paginated run history, newest first; optionally filtered by outcome.",
    },
  })
  .get("/export", ({ user }) => runList.streamExport(user.id), {
    beforeHandle: rateLimit(RATE_LIMITS.pilotRunsExport),
    detail: {
      summary: "Export the run history",
      description:
        "Streams every finished run as newline-delimited JSON (oldest first) for offline analysis.",
    },
  })
  .get("/:id", ({ user, params }) => runs.get(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Get a run",
      description: "Returns one run with its task type and payload.",
    },
  })
  .post("/:id/heartbeat", ({ user, params }) => runs.heartbeat(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Heartbeat a run",
      description: "Extends the run TTL by 15 minutes and records the heartbeat.",
    },
  })
  .post("/:id/cancel", ({ user, params }) => runs.cancel(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Cancel a run",
      description:
        "Closes an open run as cancelled and returns an applying job to approved. A finished run is returned unchanged.",
    },
  })
  .post("/:id/interrupt", ({ user, params }) => runs.interrupt(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: okResponseSchema,
    detail: {
      summary: "Interrupt a run",
      description:
        "Asks the host working the run to stop it. Rejects with 409 once the run is finished.",
    },
  })
  .post("/:id/steer", ({ user, params, body }) => runs.steer(user.id, params.id, body.text), {
    params: idParam,
    body: steerPilotRunSchema,
    beforeHandle: limitRun,
    response: okResponseSchema,
    detail: {
      summary: "Tell the running task something",
      description:
        "Asks the host to type one line into the session working the run, without stopping it.",
    },
  })
  .post("/:id/result", ({ user, params, body }) => runs.recordResult(user.id, params.id, body), {
    params: idParam,
    body: pilotRunResultSchema,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Post a run's result",
      description:
        "The agent's last step: stores the result line on the run and finishes it. A finished run is returned unchanged, so retries are safe.",
    },
  })
  .post("/:id/usage", ({ user, params, body }) => runs.reportUsage(user.id, params.id, body), {
    params: idParam,
    body: reportPilotUsageSchema,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Report a run's token usage",
      description: "Stores the token usage the host measured for the run.",
    },
  })
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
