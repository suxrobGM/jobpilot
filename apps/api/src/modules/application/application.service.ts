import type {
  ApplicationEventKind,
  ApplicationEventSource,
  ApplicationSource,
  ApplicationStatus,
  StatusTransitionInput,
} from "@jobpilot/contracts/application";
import { SINGLE_APPLY_CAMPAIGN, STATUSES } from "@jobpilot/contracts/application";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { singleton } from "tsyringe";
import { findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { type DuplicateLookup, findAppliedDuplicate } from "./duplicate";
import { statusChangeOps } from "./status-change";

export interface AppliedListFilters {
  status?: ApplicationStatus;
  board?: string;
  source?: string;
  search?: string;
  campaignId?: string;
}

@singleton()
export class ApplicationService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string, query: PaginationQuery & AppliedListFilters) {
    const where = this.where(userId, query);

    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        orderBy: { appliedAt: "desc" },
        ...pageSlice(query),
      }),
      this.prisma.application.count({ where }),
    ]);

    return paginate(
      rows.map((r) => ({ ...r, source: r.source as ApplicationSource })),
      query,
      total,
    );
  }

  /**
   * Per-status totals for the funnel tiles. `status` is deliberately excluded from the `where`:
   * the tiles have to keep showing every bucket's size while one of them is selected.
   */
  async summary(userId: string, filters: Omit<AppliedListFilters, "status">) {
    const where = this.where(userId, filters);
    const rows = await this.prisma.application.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    // Every status seeded to 0, so a funnel tile for an empty bucket still renders a number.
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    let total = 0;
    for (const row of rows) {
      byStatus[row.status as ApplicationStatus] = row._count._all;
      total += row._count._all;
    }
    return { total, byStatus };
  }

  private where(userId: string, filters: AppliedListFilters): Prisma.ApplicationWhereInput {
    const { status, board, source, search, campaignId } = filters;

    return {
      userId,
      ...(status && { status }),
      ...(board && { board }),
      ...(source && { source }),
      ...(campaignId && {
        campaignId: campaignId === SINGLE_APPLY_CAMPAIGN ? null : campaignId,
      }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { company: { contains: search, mode: "insensitive" } },
          { url: { contains: search, mode: "insensitive" } },
        ],
      }),
    };
  }

  async get(userId: string, id: string) {
    const row = await findOwned(
      (where) =>
        this.prisma.application.findFirst({
          where,
          include: {
            events: { orderBy: { createdAt: "asc" } },
          },
        }),
      { id, userId },
      "Application",
    );

    return {
      ...row,
      source: row.source as ApplicationSource,
      appliedAt: row.appliedAt,
      rejectedAt: row.rejectedAt,
      events: row.events.map((e) => ({
        ...e,
        kind: e.kind as ApplicationEventKind,
        source: e.source as ApplicationEventSource | null,
      })),
    };
  }

  async addEvent(userId: string, id: string, input: { kind: "note"; notes: string }) {
    await findOwned(
      (where) => this.prisma.application.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Application",
    );
    const event = await this.prisma.applicationEvent.create({
      data: { applicationId: id, kind: input.kind, note: input.notes },
    });
    return {
      ...event,
      kind: event.kind as ApplicationEventKind,
      source: event.source as ApplicationEventSource | null,
    };
  }

  async remove(userId: string, id: string) {
    await findOwned(
      (where) => this.prisma.application.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Application",
    );
    await this.prisma.application.delete({ where: { id } });
    return { deleted: id };
  }

  async transitionStatus(userId: string, id: string, input: StatusTransitionInput) {
    const existing = await findOwned(
      (where) => this.prisma.application.findFirst({ where }),
      { id, userId },
      "Application",
    );

    const fromStatus = existing.status;
    const toStatus = input.toStatus;

    if (fromStatus === toStatus) {
      return { id, status: toStatus, unchanged: true };
    }

    await this.prisma.$transaction(
      statusChangeOps(this.prisma, {
        applicationId: id,
        fromStatus,
        toStatus,
        source: "manual",
        note: input.note,
      }),
    );

    return { id, status: toStatus };
  }

  async check(userId: string, query: DuplicateLookup) {
    const duplicate = await findAppliedDuplicate(this.prisma, userId, query);
    if (!duplicate) {
      return { applied: false as const, match: null };
    }
    return { applied: true as const, match: duplicate };
  }
}
