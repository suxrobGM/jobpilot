import { ErrorCodes } from "@jobpilot/contracts/errors";
import { type PilotTask, type TaskType, taskListSchema } from "@jobpilot/contracts/pilot";
import { conflict } from "@/common/errors";
import { toInputJson } from "@/common/json";
import type { Prisma } from "@/generated/prisma/client";
import { startApplying } from "@/modules/feed/jobs/applying";
import { toJobRef } from "../job-subject";
import {
  networkingSendWhere,
  reviewPausedWhere,
  scorePendingWhere,
} from "../tasks/gather/workable";

export const RUN_TTL_MS = 15 * 60 * 1000;

interface StartCheck {
  remaining: (tx: Prisma.TransactionClient, userId: string, subjectId: string) => Promise<number>;
  gone: string;
}

/** Task types whose row can change after the task list was built, re-checked at run start. */
const START_CHECKS: Partial<Record<TaskType, StartCheck>> = {
  "networking.send": {
    remaining: (tx, userId, id) =>
      tx.networkingMessage.count({ where: { id, ...networkingSendWhere(userId) } }),
    gone: "Networking message is no longer ready to send.",
  },
  "search.review": {
    remaining: (tx, userId, id) => tx.feed.count({ where: { id, ...reviewPausedWhere(userId) } }),
    gone: "Feed is no longer paused.",
  },
  "feed.score": {
    remaining: (tx, userId, id) => tx.feed.count({ where: { id, ...scorePendingWhere(userId) } }),
    gone: "Feed has no jobs left to score.",
  },
};

async function assertStillStartable(tx: Prisma.TransactionClient, userId: string, task: PilotTask) {
  const check = START_CHECKS[task.taskType];
  if (!check) {
    return;
  }
  const remaining = await check.remaining(tx, userId, task.subjectId);
  if (remaining === 0) {
    throw conflict(check.gone, ErrorCodes.PILOT_CONFLICT);
  }
}

/** The task as the live list has it. The no-op write locks the state row, serializing starts. */
async function lockListedTask(
  tx: Prisma.TransactionClient,
  userId: string,
  taskId: string,
): Promise<PilotTask> {
  const [locked] = await tx.pilotState.updateManyAndReturn({
    where: { userId },
    data: { userId },
    select: { taskList: true },
  });
  const taskList = locked?.taskList ? taskListSchema.parse(locked.taskList) : null;
  if (!taskList || taskList.expiresAt <= new Date()) {
    throw conflict(
      "Task list is stale; refresh it before starting a run.",
      ErrorCodes.PILOT_CONFLICT,
    );
  }
  const task = taskList.tasks.find((entry) => entry.id === taskId);
  if (!task) {
    throw conflict("Task is no longer available.", ErrorCodes.PILOT_CONFLICT);
  }
  return task;
}

/** Opens a run on a snapshot task and hands it the requests waiting on the same subject. */
export async function startRun(tx: Prisma.TransactionClient, userId: string, taskId: string) {
  const task = await lockListedTask(tx, userId, taskId);
  const subject = {
    userId,
    taskType: task.taskType,
    subjectType: task.subjectType,
    subjectId: task.subjectId,
  };
  const open = await tx.pilotRun.findFirst({
    where: { ...subject, finishedAt: null },
    select: { id: true },
  });
  if (open) {
    throw conflict("This task is already started.", ErrorCodes.PILOT_CONFLICT);
  }

  await assertStillStartable(tx, userId, task);
  const startedJob =
    task.taskType === "job.apply" ? await startApplying(tx, userId, toJobRef(task.payload)) : null;

  const chatRequests = await tx.pilotRequest.count({
    where: { ...subject, status: "pending", source: "chat" },
  });
  const run = await tx.pilotRun.create({
    data: {
      ...subject,
      title: task.title,
      payload: toInputJson(task.payload),
      expiresAt: new Date(Date.now() + RUN_TTL_MS),
      askedInChat: task.taskType === "chat.reply" || chatRequests > 0,
    },
  });
  // Any run on a requested subject does the asked-for work, whoever picked it.
  const requests = await tx.pilotRequest.updateManyAndReturn({
    where: { ...subject, status: "pending" },
    data: { status: "running", runId: run.id },
  });
  return { run, startedJob, requests };
}
