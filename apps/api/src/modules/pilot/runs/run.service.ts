import { ErrorCodes } from "@jobpilot/contracts/errors";
import {
  type PilotRun,
  type PilotRunResultInput,
  pilotRunSchema,
  type ReportPilotUsageInput,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { badRequest, conflict, findOwned, notFound } from "@/common/errors";
import { publish } from "@/common/sse";
import {
  type PilotRun as PilotRunModel,
  type PilotRunOutcome,
  PrismaClient,
} from "@/generated/prisma/client";
import { guardApply } from "@/modules/feed/jobs/apply-guard";
import { revertApplyingJobs } from "@/modules/feed/jobs/applying";
import { publishJobUpdated } from "@/modules/feed/jobs/job-events";
import { parseJobRef } from "../job-subject";
import { finishRequests, publishRequest } from "../requests/request-row";
import { RUN_TTL_MS, startRun } from "./run-start";

/** Counted from `startedAt`, so a stuck driver that keeps heartbeating still expires. */
const MAX_RUN_LIFETIME_MS = 25 * 60 * 1000;

function toPilotRun(row: PilotRunModel): PilotRun {
  return pilotRunSchema.parse(row);
}

const alreadyFinished = () => conflict("Run is already finished.", ErrorCodes.PILOT_CONFLICT);

/** The agent's answer to work asked for in chat; done needs one. */
function replyFromResult(run: PilotRunModel, body: PilotRunResultInput): string | null {
  if (!run.askedInChat) {
    return null;
  }
  const reply = body.detail?.reply ?? null;
  // Closing without it would leave the user waiting on an answer with no error.
  if (body.outcome === "done" && reply === null) {
    throw badRequest("A done result for work asked in chat needs detail.reply.");
  }
  return reply;
}

interface CloseOptions {
  /** The agent's result line, stored on the run. */
  summary?: string | null;
  /** Posted as the pilot's message in the conversation, in the same transaction. */
  reply?: string | null;
}

@injectable()
export class RunService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async start(userId: string, taskId: string) {
    const { run, startedJob, requests } = await guardApply(this.prisma, userId, () =>
      this.prisma.$transaction((tx) => startRun(tx, userId, taskId)),
    );
    if (startedJob) {
      publishJobUpdated(userId, startedJob);
    }
    for (const request of requests) {
      publishRequest(userId, request, "request.updated");
    }
    const started = toPilotRun(run);
    publish(
      pilotChannel,
      { userId },
      { type: "run.started", runId: started.id, taskType: started.taskType },
    );
    return started;
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
    if (run.finishedAt) {
      throw alreadyFinished();
    }

    const now = Date.now();
    const ceiling = run.startedAt.getTime() + MAX_RUN_LIFETIME_MS;
    const [updated] = await this.prisma.pilotRun.updateManyAndReturn({
      where: { id, userId, finishedAt: null },
      data: {
        heartbeatAt: new Date(now),
        expiresAt: new Date(Math.min(now + RUN_TTL_MS, ceiling)),
      },
    });
    if (!updated) {
      throw alreadyFinished();
    }
    return toPilotRun(updated);
  }

  async reportUsage(userId: string, id: string, body: ReportPilotUsageInput) {
    const [updated] = await this.prisma.pilotRun.updateManyAndReturn({
      where: { id, userId },
      data: body,
    });
    if (!updated) {
      throw notFound("Run not found");
    }
    return toPilotRun(updated);
  }

  /** The host gave up on the run. A repeat call returns it unchanged. */
  async cancel(userId: string, id: string) {
    const existing = await this.findRun(userId, id);
    if (existing.finishedAt) {
      return toPilotRun(existing);
    }
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

  /** A repeat call returns the finished run unchanged. */
  async recordResult(userId: string, id: string, body: PilotRunResultInput) {
    const existing = await this.findRun(userId, id);
    if (existing.finishedAt) {
      return toPilotRun(existing);
    }

    const reply = replyFromResult(existing, body);
    const run = await this.close(userId, existing, body.outcome, { summary: body.summary, reply });
    publish(pilotChannel, { userId }, { type: "run.finished", runId: id, outcome: body.outcome });
    return run;
  }

  private async findOpenRun(userId: string, id: string) {
    const run = await this.findRun(userId, id);
    if (run.finishedAt) {
      throw alreadyFinished();
    }
    return run;
  }

  private findRun(userId: string, id: string) {
    return findOwned((where) => this.prisma.pilotRun.findFirst({ where }), { id, userId }, "Run");
  }

  private async close(
    userId: string,
    existing: PilotRunModel,
    outcome: PilotRunOutcome,
    { summary = null, reply = null }: CloseOptions = {},
  ) {
    const runId = existing.id;
    const { finished, requests, message } = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      // Otherwise the job stays `applying` until the stale sweep.
      if (outcome === "cancelled" && existing.taskType === "job.apply") {
        await revertApplyingJobs(tx, userId, [parseJobRef(existing.payload)]);
      }
      const [row] = await tx.pilotRun.updateManyAndReturn({
        where: { id: runId, userId, finishedAt: null },
        data: { finishedAt: now, outcome, summary },
      });
      if (!row) {
        throw conflict("Run was finished concurrently.", ErrorCodes.PILOT_CONFLICT);
      }
      return {
        finished: row,
        message: reply
          ? await tx.pilotMessage.create({
              data: { userId, author: "pilot", body: reply, runId },
            })
          : null,
        requests: await finishRequests(tx, [runId], outcome, now),
      };
    });
    for (const request of requests) {
      publishRequest(userId, request, "request.updated");
    }
    if (message) {
      publish(pilotChannel, { userId }, { type: "message.created", message });
    }
    return toPilotRun(finished);
  }
}
