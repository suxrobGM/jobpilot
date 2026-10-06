import {
  type PilotRun,
  type PilotRunResultInput,
  type PilotTask,
  pilotRunSchema,
  type ReportPilotUsageInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { singleton } from "tsyringe";
import { conflict, findOwned, notFound } from "@/common/errors";
import { reviveJsonDates, toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import {
  type Job,
  type PilotRun as PilotRunModel,
  type PilotRunOutcome,
  type Prisma,
  PrismaClient,
} from "@/generated/prisma/client";
import {
  type AlreadyAppliedError,
  guardApply,
  skipAppliedDuplicate,
  startApplying,
} from "@/modules/campaign/jobs/apply-guard";
import { publishJob } from "@/modules/campaign/jobs/job-events";
import { PilotJournalService } from "../journal.service";
import { startApplyBatch } from "./apply-batch";
import { NEEDS_WORKER_VISIT } from "./gather-campaigns";
import { applyJobRefs, revertApplyingJobs } from "./run-history";
import { parseTaskListSnapshot } from "./snapshot";

const RUN_TTL_MS = 15 * 60 * 1000;
/** Counted from `startedAt`, so a stuck driver that keeps heartbeating still expires. */
const MAX_RUN_LIFETIME_MS = 25 * 60 * 1000;

function toPilotRun(row: PilotRunModel): PilotRun {
  return pilotRunSchema.parse({ ...row, payload: reviveJsonDates(row.payload) });
}

/** Re-checks task types whose row can change after the task list was built. */
async function assertStillStartable(
  tx: Prisma.TransactionClient,
  userId: string,
  task: PilotTask,
): Promise<void> {
  const { subjectId } = task;
  let remaining: number;
  let gone: string;
  switch (task.taskType) {
    case "promotion.post":
      remaining = await tx.promotionPost.count({
        where: { id: subjectId, userId, status: "approved" },
      });
      gone = "Promotion post is no longer approved.";
      break;
    case "networking.send":
      remaining = await tx.networkingMessage.count({
        where: { id: subjectId, userId, status: "approved" },
      });
      gone = "Networking message is no longer approved.";
      break;
    case "campaign.reviewPaused":
      remaining = await tx.campaign.count({
        where: { campaignId: subjectId, userId, status: "paused" },
      });
      gone = "Campaign is no longer paused.";
      break;
    case "campaign.scorePending":
      remaining = await tx.campaign.count({
        where: {
          campaignId: subjectId,
          userId,
          status: "in_progress",
          jobs: { some: NEEDS_WORKER_VISIT },
        },
      });
      gone = "Campaign has no jobs left to score.";
      break;
    default:
      return;
  }
  if (remaining === 0) throw conflict(gone);
}

@singleton()
export class RunService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly journal: PilotJournalService,
  ) {}

  async start(userId: string, taskListVersion: string, taskId: string) {
    const { run, started, duplicates } = await guardApply(this.prisma, userId, () =>
      this.prisma.$transaction((tx) =>
        this.startInTransaction(tx, userId, taskListVersion, taskId),
      ),
    );
    for (const job of started) publishJob(userId, job, "updated");
    // After the commit, as guardApply does for a single apply: a refused batch entry rolled nothing back.
    for (const duplicate of duplicates) await skipAppliedDuplicate(this.prisma, userId, duplicate);
    publish(
      pilotChannel,
      { userId },
      { type: "run.started", runId: run.id, taskType: run.taskType },
    );
    return toPilotRun(run);
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
      throw conflict(state?.running ? stale : "Pilot is stopped.");
    }

    const task = parseTaskListSnapshot(locked.taskListSnapshot).tasks.find(
      (entry) => entry.id === taskId,
    );
    if (!task) throw conflict("Task is no longer available.");

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
    if (open) throw conflict("This task is already started.");

    await assertStillStartable(tx, userId, task);
    let payload: unknown = task.payload;
    let started: Job[] = [];
    let duplicates: AlreadyAppliedError[] = [];
    if (task.taskType === "job.apply") {
      started = [await startApplying(tx, userId, task.payload.campaignId, task.payload.jobKey)];
    } else if (task.taskType === "job.applyBatch") {
      const batch = await startApplyBatch(tx, userId, task.payload.jobs, now);
      // The run holds only what started, so the stale sweep and the worker never see a dropped entry.
      payload = { jobs: batch.jobs };
      ({ started, duplicates } = batch);
    }

    const run = await tx.pilotRun.create({
      data: {
        userId,
        taskType: task.taskType,
        subjectType: task.subjectType,
        subjectId: task.subjectId,
        payload: toInputJson(payload),
        expiresAt: new Date(now.getTime() + RUN_TTL_MS),
      },
    });
    return { run, started, duplicates };
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
    if (run.finishedAt) throw conflict("Run is already finished.");

    const now = Date.now();
    const ceiling = run.startedAt.getTime() + MAX_RUN_LIFETIME_MS;
    const [updated] = await this.prisma.pilotRun.updateManyAndReturn({
      where: { id, userId, finishedAt: null },
      data: {
        heartbeatAt: new Date(now),
        expiresAt: new Date(Math.min(now + RUN_TTL_MS, ceiling)),
      },
    });
    if (!updated) throw conflict("Run is already finished.");
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

  private async close(userId: string, existing: PilotRunModel, outcome: PilotRunOutcome) {
    const finished = await this.prisma.$transaction(async (tx) => {
      // Otherwise the job stays `applying` until the stale sweep.
      if (outcome === "cancelled") await revertApplyingJobs(tx, userId, applyJobRefs(existing));
      const [row] = await tx.pilotRun.updateManyAndReturn({
        where: { id: existing.id, userId, finishedAt: null },
        data: { finishedAt: new Date(), outcome },
      });
      if (!row) throw conflict("Run was finished concurrently.");
      return row;
    });
    return toPilotRun(finished);
  }

  /** The run id is the journal cycleId, so the host's cycle entry for this run groups with it. */
  async postResult(userId: string, id: string, body: PilotRunResultInput) {
    const existing = await this.findRow(userId, id);
    if (existing.finishedAt) return toPilotRun(existing);

    const run = await this.close(userId, existing, body.outcome);
    const action = {
      kind: "action" as const,
      summary: body.summary,
      subjectType: body.subjectType ?? run.subjectType,
      subjectId: body.subjectId ?? run.subjectId,
      detail: body.detail,
    };
    await this.journal.appendJournal(userId, { cycleId: id, entries: [action] });
    // After the journal line, so a run.finished listener already sees the result.
    publish(pilotChannel, { userId }, { type: "run.finished", runId: id, outcome: body.outcome });
    return run;
  }
}
