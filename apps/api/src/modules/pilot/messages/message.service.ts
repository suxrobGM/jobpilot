import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { TASK_LIST_SNAPSHOT_RESET } from "../tasks/snapshot";

@injectable()
export class MessageService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  /** The host wakes on `message.created`, and the next task list carries one chat.reply. */
  async create(userId: string, body: string) {
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pilotMessage.create({ data: { userId, author: "user", body } });
      await tx.pilotState.updateMany({ where: { userId }, data: TASK_LIST_SNAPSHOT_RESET });
      return created;
    });
    publish(pilotChannel, { userId }, { type: "message.created", message });
    return message;
  }

  /** The newest `limit` messages, oldest first, as the reply skill reads them. */
  async listRecent(userId: string, limit: number) {
    const rows = await this.prisma.pilotMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse();
  }
}
