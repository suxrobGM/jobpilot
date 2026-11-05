import { inject, injectable } from "@needle-di/core";
import { PrismaClient } from "@/generated/prisma/client";
import { OPEN_CAMPAIGN_STATUSES } from "@/modules/campaign/campaign.utils";
import { resumePausedFeed } from "./feeds";
import { PilotService } from "./pilot.service";
import { hasPendingRunNow } from "./tasks/run-history";
import { TASK_LIST_SNAPSHOT_RESET } from "./tasks/snapshot";

@injectable()
export class ResearchService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly pilot = inject(PilotService),
  ) {}

  async getStatus(userId: string) {
    const [state, lastRun, campaign] = await Promise.all([
      this.prisma.pilotState.findUnique({
        where: { userId },
        select: { researchRequestedAt: true },
      }),
      this.prisma.pilotRun.findFirst({
        where: { userId, taskType: "research.explore" },
        orderBy: { startedAt: "desc" },
        select: {
          startedAt: true,
          finishedAt: true,
          outcome: true,
          journalEntries: {
            where: { kind: "action" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { summary: true },
          },
        },
      }),
      this.prisma.campaign.findFirst({
        where: { userId, feed: "research", status: { in: OPEN_CAMPAIGN_STATUSES } },
        select: { id: true },
      }),
    ]);
    const requestedAt = state?.researchRequestedAt ?? null;
    return {
      lastRun: lastRun
        ? {
            startedAt: lastRun.startedAt,
            outcome: lastRun.outcome,
            summary: lastRun.journalEntries[0]?.summary ?? null,
          }
        : null,
      campaignId: campaign?.id ?? null,
      requestedAt: hasPendingRunNow(requestedAt, lastRun, new Date()) ? requestedAt : null,
    };
  }

  async runNow(userId: string) {
    const now = new Date();
    await Promise.all([
      resumePausedFeed(this.prisma, userId, "research"),
      this.prisma.pilotState.upsert({
        where: { userId },
        create: { userId, researchRequestedAt: now },
        update: { researchRequestedAt: now, ...TASK_LIST_SNAPSHOT_RESET },
      }),
    ]);
    // The terminal host ends its idle sleep on `state.changed`, so the run starts in seconds.
    await this.pilot.publishCurrentState(userId);
    return this.getStatus(userId);
  }
}
