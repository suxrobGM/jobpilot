import { inject, injectable } from "@needle-di/core";
import { PrismaClient } from "@/generated/prisma/client";

@injectable()
export class ResearchService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async getStatus(userId: string) {
    const [lastRun, feed] = await Promise.all([
      this.prisma.pilotRun.findFirst({
        where: { userId, taskType: "research.explore" },
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          outcome: true,
          summary: true,
        },
      }),
      this.prisma.feed.findFirst({
        where: { userId, kind: "research" },
        select: { id: true },
      }),
    ]);
    return { lastRun, feedId: feed?.id ?? null };
  }
}
