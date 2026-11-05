import type { CreatePilotRequestInput, PilotRequest } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { conflict } from "@/common/errors";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import {
  type PilotRequest as PilotRequestModel,
  type PilotRequestSource,
  PrismaClient,
} from "@/generated/prisma/client";
import { TASK_LIST_SNAPSHOT_RESET } from "../tasks/snapshot";
import { requestSubject, toPilotRequest } from "./request-row";

export function publishRequest(
  userId: string,
  row: PilotRequestModel,
  type: "request.created" | "request.updated",
): PilotRequest {
  const request = toPilotRequest(row);
  publish(pilotChannel, { userId }, { type, request });
  return request;
}

@injectable()
export class RequestService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** Queues the work; the host wakes on `request.created` and runs it next, autopilot or not. */
  async create(userId: string, input: CreatePilotRequestInput, source: PilotRequestSource) {
    if (input.taskType === "job.apply") {
      await this.approveJob(userId, input.payload.campaignId, input.payload.jobKey);
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
      await tx.pilotState.updateMany({ where: { userId }, data: TASK_LIST_SNAPSHOT_RESET });
      return created;
    });
    return publishRequest(userId, row, "request.created");
  }

  /** Applying is for approved jobs; a found one the user picks is approved on the way. */
  private async approveJob(userId: string, campaignId: string, key: string) {
    const job = await this.prisma.campaignJob.findFirst({
      where: { userId, campaignId, key },
      select: { status: true },
    });
    if (!job || !["pending", "approved"].includes(job.status)) {
      throw conflict("This job can't be applied to from where it is now.");
    }
    if (job.status === "pending") {
      await this.prisma.campaignJob.updateMany({
        where: { userId, campaignId, key, status: "pending" },
        data: { status: "approved" },
      });
    }
  }
}
