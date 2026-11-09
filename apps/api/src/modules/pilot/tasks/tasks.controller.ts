import { currentTaskListSchema, taskListSchema } from "@jobpilot/contracts/pilot";
import { Elysia } from "elysia";
import { container } from "@/common/di/container";
import { authGuard } from "@/common/middleware";
import { RATE_LIMITS, rateLimit } from "@/common/rate-limit";
import { TaskListService } from "./task-list.service";

const taskList = container.get(TaskListService);
const limitTaskList = rateLimit(RATE_LIMITS.pilotTasks);

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
  });
