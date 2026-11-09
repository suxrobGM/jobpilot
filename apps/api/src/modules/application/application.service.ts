import type {
  ApplicationSource,
  ApplicationStatus,
  StatusTransitionInput,
} from "@jobpilot/contracts/application";
import { APPLICATION_STATUSES, SINGLE_APPLY_FEED } from "@jobpilot/contracts/application";
import { type PaginationQuery, pageSlice, paginate } from "@jobpilot/contracts/pagination";
import { inject, injectable } from "@needle-di/core";
import type { z } from "zod/v4";
import { findOwned } from "@/common/errors";
import { type Prisma, PrismaClient } from "@/generated/prisma/client";
import { boardFilter } from "@/modules/job-board/board-host";
import { BOARD_REF_SELECT } from "@/modules/job-board/job-board.service";
import type { appendNoteSchema } from "./application.schema";
import { type DuplicateLookup, findAppliedDuplicate } from "./duplicate";
import { statusChangeOps } from "./status-change";

export interface AppliedListFilters {
  status?: ApplicationStatus;
  board?: string;
  source?: ApplicationSource;
  search?: string;
  feedId?: string;
}

@injectable()
export class ApplicationService {
  constructor(private readonly prisma: PrismaClient = inject(PrismaClient)) {}

  async list(userId: string, query: PaginationQuery & AppliedListFilters) {
    const where = this.where(userId, query);

    const [rows, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        include: { board: { select: BOARD_REF_SELECT } },
        orderBy: { appliedAt: "desc" },
        ...pageSlice(query),
      }),
      this.prisma.application.count({ where }),
    ]);

    return paginate(rows, query, total);
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
    const byStatus = Object.fromEntries(APPLICATION_STATUSES.map((s) => [s, 0])) as Record<
      ApplicationStatus,
      number
    >;
    let total = 0;
    for (const row of rows) {
      byStatus[row.status] = row._count._all;
      total += row._count._all;
    }
    return { total, byStatus };
  }

  async count(userId: string, filters: AppliedListFilters): Promise<number> {
    return this.prisma.application.count({ where: this.where(userId, filters) });
  }

  private where(userId: string, filters: AppliedListFilters): Prisma.ApplicationWhereInput {
    const { status, board, source, search, feedId } = filters;

    return {
      userId,
      ...(status && { status }),
      ...(board && { board: boardFilter(board) }),
      ...(source && { source }),
      ...(feedId && {
        feedId: feedId === SINGLE_APPLY_FEED ? null : feedId,
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
    return findOwned(
      (where) =>
        this.prisma.application.findFirst({
          where,
          include: {
            board: { select: BOARD_REF_SELECT },
            events: { orderBy: { createdAt: "asc" } },
            job: { select: { description: true, salary: true, employmentType: true } },
            resume: { select: { id: true, label: true, updatedAt: true } },
            resumeVariant: {
              select: { id: true, resumeId: true, label: true, changeNotes: true, updatedAt: true },
            },
            tailoredVariants: {
              select: {
                id: true,
                resumeId: true,
                label: true,
                changeNotes: true,
                createdAt: true,
                updatedAt: true,
              },
              orderBy: { createdAt: "desc" },
            },
            coverLetters: {
              select: { id: true, createdAt: true },
              orderBy: { createdAt: "desc" },
            },
            emailMessages: {
              select: {
                id: true,
                subject: true,
                fromName: true,
                receivedAt: true,
                classification: true,
              },
              orderBy: { receivedAt: "desc" },
            },
            contacts: {
              select: {
                id: true,
                name: true,
                title: true,
                company: true,
                email: true,
                linkedinUrl: true,
              },
            },
          },
        }),
      { id, userId },
      "Application",
    );
  }

  async addEvent(userId: string, id: string, input: z.infer<typeof appendNoteSchema>) {
    await findOwned(
      (where) => this.prisma.application.findFirst({ where, select: { id: true } }),
      { id, userId },
      "Application",
    );
    const event = await this.prisma.applicationEvent.create({
      data: { applicationId: id, kind: input.kind, note: input.notes },
    });
    return event;
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
