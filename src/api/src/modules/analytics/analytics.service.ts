import { singleton } from "tsyringe";
import { PrismaClient } from "@/generated/prisma/client";
import type {
  AnalyticsContactSourceEntry,
  AnalyticsPerDayEntry,
  AnalyticsStageBreakdownEntry,
  AnalyticsStatsDto,
  AnalyticsTopBoardEntry,
  AnalyticsTopReasonEntry,
} from "@/types/analytics";

const NON_INTERVIEWING_STAGES = ["applied", "rejected", "withdrawn"] as const;
const DAYS_IN_TIMELINE = 30;

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfWeek(): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - 6);
  return d;
}

function startOfTimeline(): Date {
  const d = startOfDay(new Date());
  d.setDate(d.getDate() - (DAYS_IN_TIMELINE - 1));
  return d;
}

function isoDateKey(d: Date): string {
  return startOfDay(d).toISOString().slice(0, 10);
}

/** Bucket timestamps into a zero-filled, day-by-day series over the timeline window. */
function bucketPerDay(dates: Date[], start: Date): AnalyticsPerDayEntry[] {
  const perDayMap = new Map<string, number>();
  for (let i = 0; i < DAYS_IN_TIMELINE; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    perDayMap.set(isoDateKey(d), 0);
  }
  for (const date of dates) {
    const key = isoDateKey(date);
    if (perDayMap.has(key)) {
      perDayMap.set(key, (perDayMap.get(key) ?? 0) + 1);
    }
  }
  return Array.from(perDayMap.entries()).map(([date, count]) => ({ date, count }));
}

@singleton()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaClient) {}

  async stats(profileId: number): Promise<AnalyticsStatsDto> {
    const weekStart = startOfWeek();
    const timelineStart = startOfTimeline();

    const [
      totalApplications,
      totalSubmitted,
      totalInterviewing,
      totalOffers,
      totalRejected,
      queueDepth,
      weekSubmitted,
      weekInterviewing,
      weekRejected,
      stageGroupRows,
      timelineRows,
      boardGroupRows,
      failReasonRows,
      outreachStatusRows,
      outreachContacts,
      outreachWeekSent,
      outreachWeekReplied,
      outreachTimelineRows,
      contactSourceRows,
    ] = await Promise.all([
      this.prisma.application.count({ where: { profileId } }),
      this.prisma.application.count({ where: { profileId, stage: "applied" } }),
      this.prisma.application.count({
        where: { profileId, stage: { notIn: [...NON_INTERVIEWING_STAGES] } },
      }),
      this.prisma.application.count({ where: { profileId, stage: "offer" } }),
      this.prisma.application.count({ where: { profileId, stage: "rejected" } }),
      this.prisma.queueEntry.count({ where: { profileId, status: "pending" } }),
      this.prisma.application.count({
        where: { profileId, stage: "applied", appliedAt: { gte: weekStart } },
      }),
      this.prisma.application.count({
        where: {
          profileId,
          stage: { notIn: [...NON_INTERVIEWING_STAGES] },
          appliedAt: { gte: weekStart },
        },
      }),
      this.prisma.application.count({
        where: { profileId, stage: "rejected", appliedAt: { gte: weekStart } },
      }),
      this.prisma.application.groupBy({
        by: ["stage"],
        where: { profileId },
        _count: { _all: true },
      }),
      this.prisma.application.findMany({
        where: { profileId, appliedAt: { gte: timelineStart } },
        select: { appliedAt: true },
      }),
      this.prisma.application.groupBy({
        by: ["board"],
        where: { profileId, board: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      this.prisma.job.groupBy({
        by: ["failReason"],
        where: { failReason: { not: null }, campaign: { profileId } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      this.prisma.outreachMessage.groupBy({
        by: ["status"],
        where: { profileId },
        _count: { _all: true },
      }),
      this.prisma.outreachMessage.findMany({
        where: { profileId },
        select: { contactId: true },
        distinct: ["contactId"],
      }),
      this.prisma.outreachMessage.count({ where: { profileId, sentAt: { gte: weekStart } } }),
      this.prisma.outreachMessage.count({ where: { profileId, repliedAt: { gte: weekStart } } }),
      this.prisma.outreachMessage.findMany({
        where: { profileId, sentAt: { gte: timelineStart } },
        select: { sentAt: true },
      }),
      this.prisma.contact.groupBy({
        by: ["discoverySource"],
        where: { profileId, discoverySource: { not: null }, messages: { some: {} } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    const stageBreakdown: AnalyticsStageBreakdownEntry[] = stageGroupRows.map((r) => ({
      stage: r.stage,
      count: r._count._all,
    }));

    const perDay = bucketPerDay(
      timelineRows.map((r) => r.appliedAt),
      timelineStart,
    );

    const topBoards: AnalyticsTopBoardEntry[] = boardGroupRows
      .filter((r) => r.board)
      .map((r) => ({ board: r.board as string, count: r._count._all }));

    const topRejectReasons: AnalyticsTopReasonEntry[] = failReasonRows
      .filter((r) => r.failReason)
      .map((r) => ({ reason: r.failReason as string, count: r._count._all }));

    const responded = totalInterviewing + totalRejected;
    const responseRatePct =
      totalSubmitted + responded > 0
        ? Math.round((responded / (totalSubmitted + responded)) * 100)
        : 0;

    const outreachByStatus = new Map(outreachStatusRows.map((r) => [r.status, r._count._all]));
    const outreachReplied = outreachByStatus.get("replied") ?? 0;
    const outreachBounced = outreachByStatus.get("bounced") ?? 0;
    // Dispatched = every message that left: still-sent + replied + bounced.
    const outreachSent = (outreachByStatus.get("sent") ?? 0) + outreachReplied + outreachBounced;
    const replyRatePct = outreachSent > 0 ? Math.round((outreachReplied / outreachSent) * 100) : 0;

    const topContactSources: AnalyticsContactSourceEntry[] = contactSourceRows
      .filter((r) => r.discoverySource)
      .map((r) => ({ source: r.discoverySource as string, count: r._count._all }));

    const perDaySent = bucketPerDay(
      outreachTimelineRows.map((r) => r.sentAt as Date),
      timelineStart,
    );

    const stats: AnalyticsStatsDto = {
      totals: {
        applications: totalApplications,
        submitted: totalSubmitted,
        interviewing: totalInterviewing,
        offers: totalOffers,
        rejected: totalRejected,
        queueDepth,
      },
      thisWeek: {
        submitted: weekSubmitted,
        interviewing: weekInterviewing,
        rejected: weekRejected,
      },
      responseRatePct,
      stageBreakdown,
      perDay,
      topBoards,
      topRejectReasons,
      outreach: {
        totals: {
          contacts: outreachContacts.length,
          sent: outreachSent,
          replied: outreachReplied,
          bounced: outreachBounced,
        },
        thisWeek: {
          sent: outreachWeekSent,
          replied: outreachWeekReplied,
        },
        replyRatePct,
        perDaySent,
        topContactSources,
      },
    };

    return stats;
  }
}
