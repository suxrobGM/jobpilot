import { ErrorCodes } from "@jobpilot/contracts/errors";
import {
  type CreatePilotJournalInput,
  type PilotRun,
  type PilotRunResultInput,
  type PilotTask,
  pilotRunSchema,
  type ReportPilotUsageInput,
  type TaskType,
  taskListSchema,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { badRequest, conflict, findOwned, notFound } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import {
  type PilotRun as PilotRunModel,
  type PilotRunOutcome,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import { guardApply } from "@/modules/feed/jobs/apply-guard";
import { parseJobRef, revertApplyingJobs, startApplying } from "@/modules/feed/jobs/applying";
import { publishJobUpdated } from "@/modules/feed/jobs/job-events";
import { publishRequest } from "../requests/request.service";
import { finishRequests } from "../requests/request-row";
import {
  networkingSendWhere,
  reviewPausedWhere,
  scorePendingWhere,
} from "../tasks/gather/workable";
import { PilotJournalService } from "../thread/journal.service";
import { writeJournalEntries } from "../thread/journal-entries";

const RUN_TTL_MS = 15 * 60 * 1000;
/** Counted from `startedAt`, so a stuck driver that keeps heartbeating still expires. */
const MAX_RUN_LIFETIME_MS = 25 * 60 * 1000;

function toPilotRun(row: PilotRunModel): PilotRun {
  return pilotRunSchema.parse(row);
}

const alreadyFinished = () => conflict("Run is already finished.", ErrorCodes.PILOT_CONFLICT);

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
  if (!check) return;
  const remaining = await check.remaining(tx, userId, task.subjectId);
  if (remaining === 0) throw conflict(check.gone, ErrorCodes.PILOT_CONFLICT);
}

/** The task as the live snapshot lists it. The no-op write locks the state row, serializing starts. */
async function lockSnapshotTask(
  tx: Prisma.TransactionClient,
  userId: string,
  taskListVersion: string,
  taskId: string,
): Promise<PilotTask> {
  const [locked] = await tx.pilotState.updateManyAndReturn({
    where: { userId, taskListVersion, taskListExpiresAt: { gt: new Date() } },
    data: { taskListVersion },
    select: { taskListSnapshot: true },
  });
  if (!locked?.taskListSnapshot) {
    throw conflict(
      "Task list is stale; refresh it before starting a run.",
      ErrorCodes.PILOT_CONFLICT,
    );
  }
  const { tasks } = taskListSchema.parse(locked.taskListSnapshot);
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) throw conflict("Task is no longer available.", ErrorCodes.PILOT_CONFLICT);
  return task;
}

type JournalEntryInput = CreatePilotJournalInput["entries"][number];

interface CloseOptions {
  /** Journaled under the run id in the same transaction, so a result never half-lands. */
  entries?: JournalEntryInput[];
  /** A chat reply's answer, posted as the pilot's message. */
  reply?: string | null;
}

@injectable()
export class RunService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly journal = inject(PilotJournalService),
  ) {}

  async start(userId: string, taskListVersion: string, taskId: string) {
    const { run, startedJob, requests } = await guardApply(this.prisma, userId, () =>
      this.prisma.$transaction((tx) =>
        this.startInTransaction(tx, userId, taskListVersion, taskId),
      ),
    );
    if (startedJob) publishJobUpdated(userId, startedJob);
    for (const request of requests) publishRequest(userId, request, "request.updated");
    const started = toPilotRun(run);
    publish(
      pilotChannel,
      { userId },
      { type: "run.started", runId: started.id, taskType: started.taskType },
    );
    return started;
  }

  private async startInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    taskListVersion: string,
    taskId: string,
  ) {
    const task = await lockSnapshotTask(tx, userId, taskListVersion, taskId);
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
    if (open) throw conflict("This task is already started.", ErrorCodes.PILOT_CONFLICT);

    await assertStillStartable(tx, userId, task);
    const startedJob =
      task.taskType === "job.apply"
        ? await startApplying(tx, userId, { feedId: task.payload.feedId, key: task.payload.jobKey })
        : null;

    const run = await tx.pilotRun.create({
      data: {
        ...subject,
        title: task.title,
        payload: toInputJson(task.payload),
        expiresAt: new Date(Date.now() + RUN_TTL_MS),
      },
    });
    // Any run on a requested subject does the asked-for work, whoever picked it.
    const requests = await tx.pilotRequest.updateManyAndReturn({
      where: { ...subject, status: "pending" },
      data: { status: "running", runId: run.id },
    });
    return { run, startedJob, requests };
  }

  async get(userId: string, id: string) {
    return toPilotRun(await this.findRun(userId, id));
  }

  async heartbeat(userId: string, id: string) {
    const run = await findOwned(
      (where) =>
        this.prisma.pilotRun.findFirst({ where, select: { startedAt: true, finishedAt: true } }),
      { id, userId },
      "Run",
    );
    if (run.finishedAt) throw alreadyFinished();

    const now = Date.now();
    const ceiling = run.startedAt.getTime() + MAX_RUN_LIFETIME_MS;
    const [updated] = await this.prisma.pilotRun.updateManyAndReturn({
      where: { id, userId, finishedAt: null },
      data: {
        heartbeatAt: new Date(now),
        expiresAt: new Date(Math.min(now + RUN_TTL_MS, ceiling)),
      },
    });
    if (!updated) throw alreadyFinished();
    return toPilotRun(updated);
  }

  async reportUsage(userId: string, id: string, body: ReportPilotUsageInput) {
    const [updated] = await this.prisma.pilotRun.updateManyAndReturn({
      where: { id, userId },
      data: body,
    });
    if (!updated) throw notFound("Run not found");
    return toPilotRun(updated);
  }

  /** The host gave up on the run. A repeat call returns it unchanged. */
  async cancel(userId: string, id: string) {
    const existing = await this.findRun(userId, id);
    if (existing.finishedAt) return toPilotRun(existing);
    const run = await this.close(userId, existing, "cancelled");
    publish(pilotChannel, { userId }, { type: "run.finished", runId: id, outcome: "cancelled" });
    return run;
  }

  /** Asks the host to stop the run; the host types a stop line and cancels it. */
  async interrupt(userId: string, id: string) {
    await this.findOpenRun(userId, id);
    publish(pilotChannel, { userId }, { type: "run.interrupt", runId: id });
    return { ok: true as const };
  }

  /** Asks the host to type the text into the session working the run. */
  async steer(userId: string, id: string, text: string) {
    await this.findOpenRun(userId, id);
    publish(pilotChannel, { userId }, { type: "run.steer", runId: id, text });
    return { ok: true as const };
  }

  /** The host's cycle entry for this run carries its id as `runId`, so the two group together. */
  async recordResult(userId: string, id: string, body: PilotRunResultInput) {
    const existing = await this.findRun(userId, id);
    if (existing.finishedAt) return toPilotRun(existing);

    const action: JournalEntryInput = {
      kind: "action",
      summary: body.summary,
      subjectType: body.subjectType ?? existing.subjectType,
      subjectId: body.subjectId ?? existing.subjectId,
      detail: body.detail,
    };
    // A chat reply's answer becomes the pilot's message in the conversation.
    const isChat = existing.taskType === "chat.reply";
    const reply = isChat && typeof body.detail?.reply === "string" ? body.detail.reply : null;
    // Closing without it would leave the user's message unanswered with no error.
    if (isChat && body.outcome === "done" && reply === null) {
      throw badRequest("A done chat.reply result needs its answer in detail.reply.");
    }
    const run = await this.close(userId, existing, body.outcome, { entries: [action], reply });
    // After the journal line, so a run.finished listener already sees the result.
    publish(pilotChannel, { userId }, { type: "run.finished", runId: id, outcome: body.outcome });
    return run;
  }

  private async findOpenRun(userId: string, id: string) {
    const run = await this.findRun(userId, id);
    if (run.finishedAt) throw alreadyFinished();
    return run;
  }

  private findRun(userId: string, id: string) {
    return findOwned((where) => this.prisma.pilotRun.findFirst({ where }), { id, userId }, "Run");
  }

  private async close(
    userId: string,
    existing: PilotRunModel,
    outcome: PilotRunOutcome,
    { entries = [], reply = null }: CloseOptions = {},
  ) {
    const runId = existing.id;
    const { finished, journaled, requests, message } = await this.prisma.$transaction(
      async (tx) => {
        const now = new Date();
        // Otherwise the job stays `applying` until the stale sweep.
        if (outcome === "cancelled" && existing.taskType === "job.apply") {
          await revertApplyingJobs(tx, userId, [parseJobRef(existing.payload)]);
        }
        const [row] = await tx.pilotRun.updateManyAndReturn({
          where: { id: runId, userId, finishedAt: null },
          data: { finishedAt: now, outcome },
        });
        if (!row) throw conflict("Run was finished concurrently.", ErrorCodes.PILOT_CONFLICT);
        return {
          finished: row,
          journaled:
            entries.length > 0 ? await writeJournalEntries(tx, userId, { runId, entries }) : [],
          message: reply
            ? await tx.pilotMessage.create({
                data: { userId, author: "pilot", body: reply, runId },
              })
            : null,
          requests: await finishRequests(tx, [runId], outcome, now),
        };
      },
    );
    await this.journal.publishAppended(userId, journaled);
    for (const request of requests) publishRequest(userId, request, "request.updated");
    if (message) publish(pilotChannel, { userId }, { type: "message.created", message });
    return toPilotRun(finished);
  }
}
