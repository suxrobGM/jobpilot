import {
  currentTaskListSchema,
  pilotRunResultSchema,
  pilotRunSchema,
  reportPilotUsageSchema,
  startPilotRunSchema,
  steerPilotRunSchema,
  taskListSchema,
} from "@jobpilot/contracts/pilot";
import { idParam } from "@jobpilot/contracts/shared";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { okResponseSchema } from "@/types/response";
import { RunService } from "./run.service";
import { TaskListService } from "./task-list.service";

const taskList = container.get(TaskListService);
const runs = container.get(RunService);
const limitTaskList = rateLimit(RATE_LIMITS.pilotTasks);
const limitRun = rateLimit(RATE_LIMITS.pilotRun);

export const pilotTasksController = new Elysia({ prefix: "/pilot", detail: { tags: ["Pilot"] } })
  .use(authGuard)
  .get("/tasks", ({ user }) => taskList.getCurrent(user.id), {
    beforeHandle: limitTaskList,
    response: currentTaskListSchema,
    detail: {
      summary: "Get the current task list",
      description: "Returns the unexpired task list snapshot, or null. Read-only.",
    },
  })
  .post("/tasks/refresh", ({ user }) => taskList.refresh(user.id), {
    beforeHandle: limitTaskList,
    response: taskListSchema,
    detail: {
      summary: "Refresh the task list",
      description: "Runs maintenance, then builds and stores a new expiring task list version.",
    },
  })
  .post("/runs", ({ user, body }) => runs.start(user.id, body.taskListVersion, body.taskId), {
    body: startPilotRunSchema,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Start a task run",
      description:
        "Starts a task from the given task list version as a 15-minute run. A stale version or a race returns 409.",
    },
  })
  .get("/runs/:id", ({ user, params }) => runs.get(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Get a run",
      description: "Returns one run with its task type and payload.",
    },
  })
  .post("/runs/:id/heartbeat", ({ user, params }) => runs.heartbeat(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Heartbeat a run",
      description: "Extends the run TTL by 15 minutes and records the heartbeat.",
    },
  })
  .post("/runs/:id/cancel", ({ user, params }) => runs.cancel(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Cancel a run",
      description:
        "Closes an open run as cancelled and returns an applying job to approved. A finished run is returned unchanged.",
    },
  })
  .post("/runs/:id/interrupt", ({ user, params }) => runs.interrupt(user.id, params.id), {
    params: idParam,
    beforeHandle: limitRun,
    response: okResponseSchema,
    detail: {
      summary: "Interrupt a run",
      description:
        "Asks the host working the run to stop it. Rejects with 409 once the run is finished.",
    },
  })
  .post("/runs/:id/steer", ({ user, params, body }) => runs.steer(user.id, params.id, body.text), {
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
  .post("/runs/:id/result", ({ user, params, body }) => runs.postResult(user.id, params.id, body), {
    params: idParam,
    body: pilotRunResultSchema,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Post a run's result",
      description:
        "The agent's last step: journals the action line and finishes the run. A finished run is returned unchanged, so retries are safe.",
    },
  })
  .post("/runs/:id/usage", ({ user, params, body }) => runs.reportUsage(user.id, params.id, body), {
    params: idParam,
    body: reportPilotUsageSchema,
    beforeHandle: limitRun,
    response: pilotRunSchema,
    detail: {
      summary: "Report a run's token usage",
      description: "Stores the token usage the host measured for the run.",
    },
  });
