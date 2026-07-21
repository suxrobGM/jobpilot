import type { AdminPilotQuery, AdminUserQuery } from "@jobpilot/contracts/admin";
import { type AssignableRole, hasRole } from "@jobpilot/contracts/role";
import { singleton } from "tsyringe";
import type { AuthUser } from "@/common/auth";
import { bucketPerDay, startOfTimeline, startOfWeek } from "@/common/date";
import { badRequest, forbidden, notFound } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { createPaginatedResponse } from "@/types/response";

/** The columns every admin user row is built from - shared by the list and the role mutation. */
const USER_SELECT = {
  id: true,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

type AdminUserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

/** Platform-wide reads plus the one mutation an admin surface has: granting/revoking ADMIN. */
@singleton()
export class AdminService {
  constructor(private readonly prisma: PrismaClient) {}

  async stats() {
    const weekStart = startOfWeek();
    const timelineStart = startOfTimeline();

    const [
      totalUsers,
      verifiedUsers,
      adminUsers,
      activeProfiles,
      totalCampaigns,
      activeCampaigns,
      applicationsThisWeek,
      totalBoards,
      totalBoardLinks,
      statusRows,
      topBoardRows,
      signupRows,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerified: true } }),
      this.prisma.user.count({ where: { role: { in: ["ADMIN", "SUPER_ADMIN"] } } }),
      // Active = the user applied to something or moved a campaign inside the timeline window.
      this.prisma.user.count({
        where: {
          OR: [
            { applications: { some: { appliedAt: { gte: timelineStart } } } },
            { campaigns: { some: { updatedAt: { gte: timelineStart } } } },
          ],
        },
      }),
      this.prisma.campaign.count(),
      this.prisma.campaign.count({ where: { status: "in_progress" } }),
      this.prisma.application.count({ where: { appliedAt: { gte: weekStart } } }),
      this.prisma.jobBoard.count(),
      this.prisma.userJobBoard.count(),
      this.prisma.application.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.application.groupBy({
        by: ["board"],
        where: { board: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      this.prisma.user.findMany({
        where: { createdAt: { gte: timelineStart } },
        select: { createdAt: true },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        verified: verifiedUsers,
        admins: adminUsers,
        // The timeline window is a superset of the week, so this needs no query of its own.
        newThisWeek: signupRows.filter((row) => row.createdAt >= weekStart).length,
        active: activeProfiles,
      },
      content: {
        campaigns: totalCampaigns,
        activeCampaigns,
        // `status` is non-nullable, so the groupBy already covers every application row.
        applications: statusRows.reduce((total, row) => total + row._count._all, 0),
        applicationsThisWeek,
        boards: totalBoards,
        boardLinks: totalBoardLinks,
      },
      statusBreakdown: statusRows.map((row) => ({ status: row.status, count: row._count._all })),
      topBoards: topBoardRows
        .filter((row) => row.board)
        .map((row) => ({ board: row.board as string, count: row._count._all })),
      signupsPerDay: bucketPerDay(
        signupRows.map((row) => row.createdAt),
        timelineStart,
      ),
    };
  }

  /** The Pilot fleet: one row per PilotState, joined to its owner's email and open-question count. */
  async listPilots(query: AdminPilotQuery) {
    const { page, limit } = query;
    const [rows, total] = await Promise.all([
      this.prisma.pilotState.findMany({
        orderBy: [{ lastCycleAt: { sort: "desc", nulls: "last" } }, { userId: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          userId: true,
          enabled: true,
          lastCycleAt: true,
          cycleCount: true,
          user: { select: { email: true } },
        },
      }),
      this.prisma.pilotState.count(),
    ]);

    const userIds = rows.map((row) => row.userId);
    const questionRows = await this.prisma.pilotQuestion.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "open" },
      _count: { _all: true },
    });
    const openByUser = new Map(questionRows.map((row) => [row.userId, row._count._all]));

    const items = rows.map((row) => ({
      userEmail: row.user.email,
      userId: row.userId,
      enabled: row.enabled,
      lastCycleAt: row.lastCycleAt,
      cycleCount: row.cycleCount,
      openQuestions: openByUser.get(row.userId) ?? 0,
    }));
    return createPaginatedResponse(items, { page, limit, total });
  }

  async listUsers(actor: AuthUser, query: AdminUserQuery) {
    const { page, limit, search, role } = query;
    const where: Prisma.UserWhereInput = {
      ...(search && { email: { contains: search, mode: "insensitive" } }),
      ...(role && { role }),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = await this.project(actor, rows);
    return createPaginatedResponse(items, { page, limit, total });
  }

  /** Attach activity + the actor's rights. Three aggregates over the page's ids, never one per row. */
  private async project(actor: AuthUser, rows: AdminUserRow[]) {
    const userIds = rows.map((row) => row.id);

    const [applicationRows, campaignRows, tokenRows] = await Promise.all([
      this.prisma.application.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
        _max: { appliedAt: true },
      }),
      this.prisma.campaign.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { updatedAt: true },
      }),
      // The agent PAT's last use is the truest "this account actually runs JobPilot" signal.
      this.prisma.apiToken.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _max: { lastUsedAt: true },
      }),
    ]);

    const byApplication = new Map(applicationRows.map((row) => [row.userId, row]));
    const byCampaign = new Map(campaignRows.map((row) => [row.userId, row._max.updatedAt]));
    const byToken = new Map(tokenRows.map((row) => [row.userId, row._max.lastUsedAt]));

    return rows.map((row) => {
      const application = byApplication.get(row.id);
      const stamps = [
        application?._max.appliedAt,
        byCampaign.get(row.id),
        byToken.get(row.id),
      ].filter((date): date is Date => Boolean(date));
      const name = `${row.firstName} ${row.lastName}`.trim();

      return {
        id: row.id,
        email: row.email,
        role: row.role,
        emailVerified: row.emailVerified,
        createdAt: row.createdAt,
        name: name || null,
        applicationCount: application?._count._all ?? 0,
        lastActiveAt: stamps.length
          ? new Date(Math.max(...stamps.map((date) => date.getTime())))
          : null,
        // The server owns the policy; the client renders the capability rather than re-deriving it.
        canChangeRole: this.canChangeRole(actor, row),
      };
    });
  }

  /** Mirrors `setRole`'s guardrails, so the UI never offers an action the API would reject. */
  private canChangeRole(actor: AuthUser, target: AdminUserRow): boolean {
    return (
      hasRole(actor.role, "SUPER_ADMIN") && target.id !== actor.id && target.role !== "SUPER_ADMIN"
    );
  }

  /** With the body schema rejecting SUPER_ADMIN (422), these checks make it immutable over HTTP. */
  async setRole(actor: AuthUser, targetId: string, role: AssignableRole) {
    if (actor.id === targetId) {
      throw badRequest("You cannot change your own role");
    }
    const target = await this.prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true },
    });
    if (!target) {
      throw notFound("User not found");
    }
    if (target.role === "SUPER_ADMIN") {
      throw forbidden("A super admin's role cannot be changed");
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: { role },
      select: USER_SELECT,
    });
    const [item] = await this.project(actor, [updated]);
    return item;
  }
}
