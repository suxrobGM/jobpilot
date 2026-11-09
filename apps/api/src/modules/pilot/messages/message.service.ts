import { pilotChannel } from "@jobpilot/contracts/sse";
import { inject, injectable } from "@needle-di/core";
import { publish } from "@/common/sse";
import { PrismaClient } from "@/generated/prisma/client";
import { WebPushService } from "@/modules/web-push/web-push.service";
import { dropTaskList } from "../tasks/snapshot";

/** How an unprompted pilot message shows on the user's phone. */
interface PhoneAlert {
  title: string;
  tag: string;
}

@injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly push = inject(WebPushService),
  ) {}

  /** The host wakes on `message.created`, and the next task list carries one chat.reply. */
  async create(userId: string, body: string) {
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pilotMessage.create({ data: { userId, author: "user", body } });
      await dropTaskList(tx, userId);
      return created;
    });
    publish(pilotChannel, { userId }, { type: "message.created", message });
    return message;
  }

  /** Something the pilot tells the user unprompted, outside any run; it also reaches their phone. */
  async postFromPilot(userId: string, body: string, alert: PhoneAlert) {
    const message = await this.prisma.pilotMessage.create({
      data: { userId, author: "pilot", body },
    });
    publish(pilotChannel, { userId }, { type: "message.created", message });
    void this.push.sendToUser(userId, { ...alert, body, url: "/pilot" });
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
