import { singleton } from "tsyringe";
import { bucketPerDay, startOfTimeline, startOfWeek } from "@/common/date";
import { PrismaClient } from "@/generated/prisma/client";

const NON_INTERVIEWING_STATUSES = ["applied", "rejected", "withdrawn"] as const;

@singleton()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaClient) {}

  async stats(userId: string) {
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
      statusGroupRows,
      timelineRows,
      boardGroupRows,
      failReasonRows,
      networkingStatusRows,
      networkingContacts,
      networkingWeekSent,
      networkingWeekReplied,
      networkingTimelineRows,
      contactSourceRows,
    ] = await Promise.all([
      this.prisma.application.count({ where: { userId } }),
      this.prisma.application.count({ where: { userId, status: "applied" } }),
      this.prisma.application.count({
        where: { userId, status: { notIn: [...NON_INTERVIEWING_STATUSES] } },
      }),
      this.prisma.application.count({ where: { userId, status: "offer" } }),
      this.prisma.application.count({ where: { userId, status: "rejected" } }),
      this.prisma.job.count({ where: { status: "queued", campaign: { userId } } }),
      this.prisma.application.count({
        where: { userId, status: "applied", appliedAt: { gte: weekStart } },
      }),
      this.prisma.application.count({
        where: {
          userId,
          status: { notIn: [...NON_INTERVIEWING_STATUSES] },
          appliedAt: { gte: weekStart },
        },
      }),
      this.prisma.application.count({
        where: { userId, status: "rejected", appliedAt: { gte: weekStart } },
      }),
      this.prisma.application.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.application.findMany({
        where: { userId, appliedAt: { gte: timelineStart } },
        select: { appliedAt: true },
      }),
      this.prisma.application.groupBy({
        by: ["board"],
        where: { userId, board: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      this.prisma.job.groupBy({
        by: ["failReason"],
        where: { failReason: { not: null }, campaign: { userId } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      this.prisma.networkingMessage.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
      this.prisma.networkingMessage.findMany({
        where: { userId },
        select: { contactId: true },
        distinct: ["contactId"],
      }),
      this.prisma.networkingMessage.count({ where: { userId, sentAt: { gte: weekStart } } }),
      this.prisma.networkingMessage.count({ where: { userId, repliedAt: { gte: weekStart } } }),
      this.prisma.networkingMessage.findMany({
        where: { userId, sentAt: { gte: timelineStart } },
        select: { sentAt: true },
      }),
      this.prisma.contact.groupBy({
        by: ["discoverySource"],
        where: { userId, discoverySource: { not: null }, messages: { some: {} } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
    ]);

    const statusBreakdown = statusGroupRows.map((r) => ({
      status: r.status,
      count: r._count._all,
    }));

    const perDay = bucketPerDay(
      timelineRows.map((r) => r.appliedAt),
      timelineStart,
    );

    const topBoards = boardGroupRows
      .filter((r) => r.board)
      .map((r) => ({ board: r.board as string, count: r._count._all }));

    const topRejectReasons = failReasonRows
      .filter((r) => r.failReason)
      .map((r) => ({ reason: r.failReason as string, count: r._count._all }));

    const responded = totalInterviewing + totalRejected;
    const responseRatePct =
      totalSubmitted + responded > 0
        ? Math.round((responded / (totalSubmitted + responded)) * 100)
        : 0;

    const networkingByStatus = new Map(networkingStatusRows.map((r) => [r.status, r._count._all]));
    const networkingReplied = networkingByStatus.get("replied") ?? 0;
    const networkingBounced = networkingByStatus.get("bounced") ?? 0;
    // Dispatched = every message that left: still-sent + replied + bounced.
    const networkingSent =
      (networkingByStatus.get("sent") ?? 0) + networkingReplied + networkingBounced;
    const replyRatePct =
      networkingSent > 0 ? Math.round((networkingReplied / networkingSent) * 100) : 0;

    const topContactSources = contactSourceRows
      .filter((r) => r.discoverySource)
      .map((r) => ({ source: r.discoverySource as string, count: r._count._all }));

    const perDaySent = bucketPerDay(
      networkingTimelineRows.map((r) => r.sentAt as Date),
      timelineStart,
    );

    const stats = {
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
      statusBreakdown,
      perDay,
      topBoards,
      topRejectReasons,
      networking: {
        totals: {
          contacts: networkingContacts.length,
          sent: networkingSent,
          replied: networkingReplied,
          bounced: networkingBounced,
        },
        thisWeek: {
          sent: networkingWeekSent,
          replied: networkingWeekReplied,
        },
        replyRatePct,
        perDaySent,
        topContactSources,
      },
    };

    return stats;
  }
}
