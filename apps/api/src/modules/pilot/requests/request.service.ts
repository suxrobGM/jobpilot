import type { CreatePilotRequestInput } from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { conflict, findOwned } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { type PilotRequestSource, PrismaClient } from "@/generated/prisma/client";
import { moveStatus } from "@/modules/feed/jobs/job.service";
import { publishJobUpdated } from "@/modules/feed/jobs/job-events";
import { dropTaskList } from "../tasks/snapshot";
import { publishRequest, requestSubject, toPilotRequest } from "./request-row";

@injectable()
export class RequestService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** Queues the work; the host wakes on `request.created` and runs it next, autopilot or not. */
  async create(userId: string, input: CreatePilotRequestInput, source: PilotRequestSource) {
    if (input.taskType === "job.apply") {
      await this.approveJob(userId, input.payload.feedId, input.payload.jobKey);
    }
    const id = crypto.randomUUID();
    const subject = requestSubject(input, id);
    const payload = toInputJson(input.payload);
    const { row, created } = await this.prisma.$transaction(async (tx) => {
      // Asking twice for the same work runs it once.
      const queued = await tx.pilotRequest.findFirst({
        where: {
          userId,
          taskType: input.taskType,
          ...subject,
          status: { in: ["pending", "running"] },
          payload: { equals: payload },
        },
      });
      if (queued) {
        return { row: queued, created: false };
      }
      const row = await tx.pilotRequest.create({
        data: { id, userId, taskType: input.taskType, payload, ...subject, source },
      });
      await dropTaskList(tx, userId);
      return { row, created: true };
    });
    return created ? publishRequest(userId, row, "request.created") : toPilotRequest(row);
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
    const job = await findOwned(
      (where) =>
        this.prisma.job.findFirst({
          where,
          select: { feedId: true, key: true, url: true, title: true, company: true, status: true },
        }),
      { userId, feedId, key },
      "Job",
    );
    if (job.status === "applied") {
      throw conflict("You already applied to this job.");
    }
    if (job.status === "applying") {
      throw conflict("This job is being applied to right now.");
    }
    if (job.status === "approved") {
      return;
    }
    await moveStatus(this.prisma, userId, job, "approved");
    publishJobUpdated(userId, { feedId, key, status: "approved" });
  }
}
