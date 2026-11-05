import { ErrorCodes } from "@jobpilot/contracts/errors";
import {
  type CreatePilotJournalInput,
  type PilotRun,
  type PilotRunResultInput,
  type PilotTask,
  pilotRunSchema,
  type ReportPilotUsageInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned, notFound } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import {
  type PilotRun as PilotRunModel,
  type PilotRunOutcome,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import {
  guardApply,
  parseJobRef,
  revertApplyingJobs,
  startApplying,
} from "@/modules/campaign/jobs/apply-guard";
import { publishJob } from "@/modules/campaign/jobs/job-events";
import { PilotJournalService } from "../journal.service";
import { writeJournalEntries } from "../journal-entries";
import { parseTaskListSnapshot } from "./snapshot";
import {
  networkingSendWhere,
  promotionPostWhere,
  reviewPausedWhere,
  scorePendingWhere,
} from "./workable";

const RUN_TTL_MS = 15 * 60 * 1000;
/** Counted from `startedAt`, so a stuck driver that keeps heartbeating still expires. */
const MAX_RUN_LIFETIME_MS = 25 * 60 * 1000;

function toPilotRun(row: PilotRunModel): PilotRun {
  return pilotRunSchema.parse(row);
}

/** Re-checks task types whose row can change after the task list was built. */
async function assertStillStartable(
  tx: Prisma.TransactionClient,
  userId: string,
  task: PilotTask,
  now: Date,
): Promise<void> {
  const { subjectId } = task;
  let remaining: number;
  let gone: string;
  switch (task.taskType) {
    case "promotion.post":
      remaining = await tx.promotionPost.count({
        where: { id: subjectId, ...promotionPostWhere(userId, now) },
      });
      gone = "Promotion post is no longer ready to post.";
      break;
    case "networking.send":
      remaining = await tx.networkingMessage.count({
        where: { id: subjectId, ...networkingSendWhere(userId) },
      });
      gone = "Networking message is no longer ready to send.";
      break;
    case "campaign.reviewPaused":
      remaining = await tx.campaign.count({
        where: { id: subjectId, ...reviewPausedWhere(userId) },
      });
      gone = "Campaign is no longer paused.";
      break;
    case "campaign.scorePending":
      remaining = await tx.campaign.count({
        where: { id: subjectId, ...scorePendingWhere(userId) },
      });
      gone = "Campaign has no jobs left to score.";
      break;
    default:
      return;
  }
  if (remaining === 0) throw conflict(gone, ErrorCodes.PILOT_CONFLICT);
}

type JournalEntryInput = CreatePilotJournalInput["entries"][number];
@injectable()
export class RunService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly journal = inject(PilotJournalService),
  ) {}

  async start(userId: string, taskListVersion: string, taskId: string) {
    const { run, startedJob } = await guardApply(this.prisma, userId, () =>
      this.prisma.$transaction((tx) =>
        this.startInTransaction(tx, userId, taskListVersion, taskId),
      ),
    );
    if (startedJob) publishJob(userId, startedJob, "updated");
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
    const now = new Date();
    // The no-op write locks this user's state row, which serializes concurrent runs below.
    const [locked] = await tx.pilotState.updateManyAndReturn({
      where: { userId, running: true, taskListVersion, taskListExpiresAt: { gt: now } },
      data: { taskListVersion },
      select: { taskListSnapshot: true },
    });
    if (!locked?.taskListSnapshot) {
      const state = await tx.pilotState.findUnique({
        where: { userId },
        select: { running: true },
      });
      const stale = "Task list is stale; refresh it before starting a run.";
      throw conflict(state?.running ? stale : "Pilot is stopped.", ErrorCodes.PILOT_CONFLICT);
    }

    const task = parseTaskListSnapshot(locked.taskListSnapshot).tasks.find(
      (entry) => entry.id === taskId,
    );
    if (!task) throw conflict("Task is no longer available.", ErrorCodes.PILOT_CONFLICT);

    const open = await tx.pilotRun.findFirst({
      where: {
        userId,
        taskType: task.taskType,
        subjectType: task.subjectType,
        subjectId: task.subjectId,
        finishedAt: null,
      },
      select: { id: true },
    });
    if (open) throw conflict("This task is already started.", ErrorCodes.PILOT_CONFLICT);

    await assertStillStartable(tx, userId, task, now);
    const startedJob =
      task.taskType === "job.apply"
        ? await startApplying(tx, userId, task.payload.campaignId, task.payload.jobKey)
        : null;

    const run = await tx.pilotRun.create({
      data: {
        userId,
        taskType: task.taskType,
        subjectType: task.subjectType,
        subjectId: task.subjectId,
        payload: toInputJson(task.payload),
        expiresAt: new Date(now.getTime() + RUN_TTL_MS),
      },
    });
    return { run, startedJob };
  }

  async get(userId: string, id: string) {
    return toPilotRun(await this.findRow(userId, id));
  }

  async heartbeat(userId: string, id: string) {
    const run = await findOwned(
      (where) =>
        this.prisma.pilotRun.findFirst({ where, select: { startedAt: true, finishedAt: true } }),
      { id, userId },
      "Run",
    );
    if (run.finishedAt) throw conflict("Run is already finished.", ErrorCodes.PILOT_CONFLICT);

    const now = Date.now();
    const ceiling = run.startedAt.getTime() + MAX_RUN_LIFETIME_MS;
    const [updated] = await this.prisma.pilotRun.updateManyAndReturn({
      where: { id, userId, finishedAt: null },
      data: {
        heartbeatAt: new Date(now),
        expiresAt: new Date(Math.min(now + RUN_TTL_MS, ceiling)),
      },
    });
    if (!updated) throw conflict("Run is already finished.", ErrorCodes.PILOT_CONFLICT);
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
    const existing = await this.findRow(userId, id);
    if (existing.finishedAt) return toPilotRun(existing);
    const run = await this.close(userId, existing, "cancelled");
    publish(pilotChannel, { userId }, { type: "run.finished", runId: id, outcome: "cancelled" });
    return run;
  }

  private findRow(userId: string, id: string) {
    return findOwned((where) => this.prisma.pilotRun.findFirst({ where }), { id, userId }, "Run");
  }

  /** `entries` journal under the run id in the same transaction, so a result never half-lands. */
  private async close(
    userId: string,
    existing: PilotRunModel,
    outcome: PilotRunOutcome,
    entries: JournalEntryInput[] = [],
  ) {
    const { finished, journaled } = await this.prisma.$transaction(async (tx) => {
      // Otherwise the job stays `applying` until the stale sweep.
      if (outcome === "cancelled" && existing.taskType === "job.apply") {
        await revertApplyingJobs(tx, userId, [parseJobRef(existing.payload)]);
      }
      const [row] = await tx.pilotRun.updateManyAndReturn({
        where: { id: existing.id, userId, finishedAt: null },
        data: { finishedAt: new Date(), outcome },
      });
      if (!row) throw conflict("Run was finished concurrently.", ErrorCodes.PILOT_CONFLICT);
      const rows =
        entries.length > 0
          ? await writeJournalEntries(tx, userId, { runId: existing.id, entries })
          : [];
      return { finished: row, journaled: rows };
    });
    await this.journal.publishAppended(userId, journaled);
    return toPilotRun(finished);
  }

  /** The host's cycle entry for this run carries its id as `runId`, so the two group together. */
  async postResult(userId: string, id: string, body: PilotRunResultInput) {
    const existing = await this.findRow(userId, id);
    if (existing.finishedAt) return toPilotRun(existing);

    const action: JournalEntryInput = {
      kind: "action",
      summary: body.summary,
      subjectType: body.subjectType ?? existing.subjectType,
      subjectId: body.subjectId ?? existing.subjectId,
      detail: body.detail,
    };
    const run = await this.close(userId, existing, body.outcome, [action]);
    // After the journal line, so a run.finished listener already sees the result.
    publish(pilotChannel, { userId }, { type: "run.finished", runId: id, outcome: body.outcome });
    return run;
  }
}
