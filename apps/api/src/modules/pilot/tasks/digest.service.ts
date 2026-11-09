import { inject, injectable } from "@needle-di/core";
import { DAY_MS, minutesOfDay, startOfDay } from "@/common/date/buckets";
import { allNamed } from "@/common/utils";
import { PrismaClient } from "@/generated/prisma/client";
import { MessageService } from "../messages/message.service";

const DIGEST_HOUR_UTC = 7;

interface DigestCounts {
  applicationsCreated: number;
  jobsFailed: number;
  jobsSkipped: number;
  openQuestions: number;
  networkingSent: number;
  networkingReplies: number;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function countLastDay(db: PrismaClient, userId: string, now: Date) {
  const since = new Date(now.getTime() - DAY_MS);
  const jobs = (status: "failed" | "skipped") =>
    db.job.count({ where: { status, userId, createdAt: { gte: since } } });
  return allNamed({
    applicationsCreated: db.application.count({ where: { userId, appliedAt: { gte: since } } }),
    jobsFailed: jobs("failed"),
    jobsSkipped: jobs("skipped"),
    networkingSent: db.networkingMessage.count({ where: { userId, sentAt: { gte: since } } }),
    networkingReplies: db.networkingMessage.count({ where: { userId, repliedAt: { gte: since } } }),
  });
}

function digestSummary(counts: DigestCounts): string {
  const parts = [
    plural(counts.applicationsCreated, "application", "applications"),
    `${counts.jobsFailed + counts.jobsSkipped} not applied`,
    `${counts.networkingSent} networking sent (${plural(counts.networkingReplies, "reply", "replies")})`,
    plural(counts.openQuestions, "open question", "open questions"),
  ];
  return `Last 24h: ${parts.join(", ")}.`;
}

function isQuiet(counts: DigestCounts): boolean {
  return Object.values(counts).every((count) => count === 0);
}

@injectable()
export class DigestService {
  constructor(
    private readonly prisma: PrismaClient = inject(PrismaClient),
    private readonly messages = inject(MessageService),
  ) {}

  /**
   * Posts one morning summary per UTC day, after 07:00, as a pilot message; a day with nothing to
   * report posts nothing. Called fire-and-forget, so it logs its own errors instead of rejecting.
   */
  async writeIfDue(userId: string, now: Date, openQuestions: number): Promise<void> {
    if (minutesOfDay(now) < DIGEST_HOUR_UTC * 60) {
      return;
    }
    try {
      // Claiming the day first is the only duplicate guard: a racing refresh matches no row.
      const { count } = await this.prisma.pilotState.updateMany({
        where: { userId, OR: [{ digestAt: null }, { digestAt: { lt: startOfDay(now) } }] },
        data: { digestAt: now },
      });
      if (count === 0) {
        return;
      }
      const counts = { ...(await countLastDay(this.prisma, userId, now)), openQuestions };
      if (isQuiet(counts)) {
        return;
      }
      await this.messages.postFromPilot(userId, digestSummary(counts), {
        title: "Your Pilot's morning digest",
        tag: "pilot-digest",
      });
    } catch (err) {
      console.error("[pilot] digest write failed", err);
    }
  }
}
