import type { CreatePilotRequestInput } from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { conflict, notFound } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { type PilotRequestSource, PrismaClient } from "@/generated/prisma/client";
import { OUTCOME_CLEARED } from "@/modules/feed/jobs/job.service";
import { publishJobUpdated } from "@/modules/feed/jobs/job-events";
import { dropTaskList } from "../tasks/snapshot";
import { publishRequest, requestSubject } from "./request-row";

@injectable()
export class RequestService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** Queues the work; the host wakes on `request.created` and runs it next, autopilot or not. */
  async create(userId: string, input: CreatePilotRequestInput, source: PilotRequestSource) {
    if (input.taskType === "job.apply") {
      await this.approveJob(userId, input.payload.feedId, input.payload.jobKey);
    }
    const id = crypto.randomUUID();
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pilotRequest.create({
        data: {
          id,
          userId,
          taskType: input.taskType,
          payload: toInputJson(input.payload),
          ...requestSubject(input, id),
          source,
        },
      });
      await dropTaskList(tx, userId);
      return created;
    });
    return publishRequest(userId, row, "request.created");
  }

  /** Only queued work stops; a running request ends with its run. */
  async cancel(userId: string, id: string) {
    const row = await this.prisma.$transaction(async (tx) => {
      const [cancelled] = await tx.pilotRequest.updateManyAndReturn({
        where: { id, userId, status: "pending" },
        data: { status: "cancelled", finishedAt: new Date() },
      });
      if (!cancelled) {
        throw conflict("Only queued work can be cancelled.");
      }
      await dropTaskList(tx, userId);
      return cancelled;
    });
    return publishRequest(userId, row, "request.updated");
  }

  /**
   * The user asked for this job by name, so it overrides the pilot's own calls: a skip, a low
   * score, a failure. Only an application already sent or in flight stops it; the duplicate guard
   * at run start still catches the same posting applied elsewhere.
   */
  private async approveJob(userId: string, feedId: string, key: string) {
    const job = await this.prisma.job.findFirst({
      where: { userId, feedId, key },
      select: { id: true, status: true },
    });
    if (!job) {
      throw notFound("Job not found");
    }
    if (job.status === "applied") {
      throw conflict("You already applied to this job.");
    }
    if (job.status === "applying") {
      throw conflict("This job is being applied to right now.");
    }
    if (job.status === "approved") {
      return;
    }
    const [approved] = await this.prisma.job.updateManyAndReturn({
      where: { id: job.id, status: job.status },
      data: { status: "approved", ...OUTCOME_CLEARED },
      select: { feedId: true, key: true, status: true },
    });
    if (approved) {
      publishJobUpdated(userId, approved);
    }
  }
}
