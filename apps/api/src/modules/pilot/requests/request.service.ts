import type { CreatePilotRequestInput } from "@jobpilot/contracts/pilot";
import { inject, injectable } from "@needle-di/core";
import { conflict } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { type PilotRequestSource, PrismaClient } from "@/generated/prisma/client";
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

  /** Applying is for approved jobs; a found one the user picks is approved on the way. */
  private async approveJob(userId: string, feedId: string, key: string) {
    const job = await this.prisma.job.findFirst({
      where: { userId, feedId, key },
      select: { status: true },
    });
    if (!job || !["pending", "approved"].includes(job.status)) {
      throw conflict("This job can't be applied to from where it is now.");
    }
    if (job.status === "pending") {
      await this.prisma.job.updateMany({
        where: { userId, feedId, key, status: "pending" },
        data: { status: "approved" },
      });
    }
  }
}
